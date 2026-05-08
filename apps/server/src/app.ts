/**
 * Express app factory + entry point. buildApp() returns a configured
 * app that tests can drive via supertest() without binding a port.
 */
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { pathToFileURL } from "node:url";

import healthRoutes from "./routes/health.routes.js";
import productsRoutes from "./routes/products.routes.js";
import storesRoutes from "./routes/stores.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import tagsRoutes from "./routes/tags.routes.js";
import authRoutes from "./routes/auth.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import couponsRoutes from "./routes/coupons.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import reviewsRoutes, { productReviewsRouter } from "./routes/reviews.routes.js";
import favoritesRoutes from "./routes/favorites.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import referenceRoutes from "./routes/reference.routes.js";
import settingsRoutes, { adminSettingsRouter } from "./routes/settings.routes.js";
import { stripeSellerRouter, stripeAdminRouter } from "./routes/stripe.routes.js";
// Stripe webhook MUST mount before express.json (raw-body signature check).
import stripeWebhookRoutes from "./routes/stripe-webhook.routes.js";

import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import helmet from "helmet";

import { corsMiddleware } from "./middleware/cors.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error.js";

export function buildApp() {
  const app = express();

  // Trust only Fly's edge hop for X-Forwarded-For — never the full chain.
  app.set("trust proxy", 1);

  // Helmet first so 4xx responses still ship HSTS / X-Frame-Options.
  // CSP allowlist covers the Google OAuth + Inter font + avatar URLs.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "img-src":     ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com"],
          "connect-src": ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com"],
          "style-src":   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src":    ["'self'", "https://fonts.gstatic.com"],
          "frame-ancestors": ["'none'"],
        },
      },
      hsts: { maxAge: 15_552_000, includeSubDomains: true },
      // Next standalone under Fly trips on COEP: require-corp.
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Logger first so failed requests still show up.
  app.use(loggerMiddleware);
  // CORS before json so OPTIONS preflight gets the right headers.
  app.use(corsMiddleware);

  // better-auth catch-all MUST run before express.json() (raw body).
  app.all("/api/auth/better/*", toNodeHandler(auth));

  // Stripe webhook also needs raw bytes for signature verification.
  app.use("/api/webhooks/stripe", stripeWebhookRoutes);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/health",     healthRoutes);
  app.use("/products",   productsRoutes);
  app.use("/stores",     storesRoutes);
  app.use("/categories", categoriesRoutes);
  app.use("/tags",       tagsRoutes);
  app.use("/auth",       authRoutes);
  app.use("/cart",       cartRoutes);
  app.use("/coupons",    couponsRoutes);
  app.use("/orders",     ordersRoutes);

  // POST /products/:productId/reviews must mount before the products
  // router so it wins over the /:id catch-all.
  app.use("/products/:productId/reviews", productReviewsRouter);
  app.use("/reviews",    reviewsRoutes);

  app.use("/favorites",  favoritesRoutes);
  app.use("/seller",     sellerRoutes);
  app.use("/admin",      adminRoutes);
  // referenceRoutes mounts at `/` so /business-types and /countries
  // resolve straight off the root.
  app.use("/",           referenceRoutes);
  app.use("/settings",   settingsRoutes);
  app.use("/admin",      adminSettingsRouter);
  app.use("/seller",     stripeSellerRouter);
  app.use("/admin",      stripeAdminRouter);

  app.get("/", (_req, res) => {
    res.json({
      name: "METU API",
      version: "0.1.0",
    });
  });

  // Error handler last.
  app.use(errorHandler);

  return app;
}

// Boot only when this file is the entry; tests import buildApp() directly.
const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  buildApp().listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[metu-server] listening on http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`[metu-server] CORS origin: ${CORS_ORIGIN}`);
  });

  // Business Rule 4j — pending orders auto-cancel after 15 minutes.
  // Cheap in-process sweep every 60 seconds; the underlying SQL is one
  // indexed pass over orders WHERE status='pending' AND expiredAt < now.
  // .unref() so the timer doesn't block process exit during graceful
  // shutdown / hot reloads.
  const SWEEP_INTERVAL_MS = 60_000;
  setInterval(() => {
    import("./services/orders.service.js")
      .then(({ sweepExpiredOrders }) => sweepExpiredOrders())
      .then((n) => {
        if (n > 0) {
          // eslint-disable-next-line no-console
          console.log(`[metu-server] sweepExpiredOrders cancelled ${n} pending order(s)`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[metu-server] sweepExpiredOrders error:", err);
      });
  }, SWEEP_INTERVAL_MS).unref();

  // Top-stores leaderboard freshness — REFRESH MATERIALIZED VIEW
  // CONCURRENTLY every 5 minutes so the /admin "Top stores (30d)"
  // widget stays current during a live demo without the operator
  // having to click the manual Refresh button. CONCURRENTLY = readers
  // never block (UNIQUE index on store_id is created in the matview
  // migration). Errors are logged + swallowed so a transient DB blip
  // doesn't crash the server. Tracked on globalThis so dev hot-reload
  // doesn't stack up duplicate intervals.
  const MATVIEW_REFRESH_MS = 5 * 60_000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.__metuTopStoresRefreshTimer) {
    clearInterval(g.__metuTopStoresRefreshTimer);
  }
  g.__metuTopStoresRefreshTimer = setInterval(() => {
    import("./db/prisma.js")
      .then(({ prisma }) =>
        prisma.$executeRawUnsafe(
          `REFRESH MATERIALIZED VIEW CONCURRENTLY "top_stores_30d"`,
        ),
      )
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[metu-server] top_stores_30d refresh error:", err);
      });
  }, MATVIEW_REFRESH_MS);
  g.__metuTopStoresRefreshTimer.unref?.();
}
