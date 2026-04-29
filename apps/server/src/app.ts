/**
 * Express app factory + entry point.
 *
 * Phase 13.1 → 13.11 — every resource now lives in a layered
 * `<resource>.routes.ts` → `<resource>.controller.ts` →
 * `<resource>.service.ts` → `<resource>.model.ts` quartet. The
 * legacy flat scaffold (catalog.ts, seller.ts, admin.ts, stats.ts)
 * was deleted in Phase 13.11 once every endpoint had a layered
 * replacement — see git log for the migration history.
 *
 * `buildApp()` returns a configured Express instance that tests
 * can drive via `supertest(buildApp())` without binding a port.
 * When this file is the module entry (`import.meta.url ===
 * pathToFileURL(process.argv[1]).href`), it boots the listener.
 */
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { pathToFileURL } from "node:url";

// Layered routes (Phase 13.1)
import healthRoutes from "./routes/health.routes.js";
import productsRoutes from "./routes/products.routes.js";
import storesRoutes from "./routes/stores.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import tagsRoutes from "./routes/tags.routes.js";

// Layered routes (Phase 13.2 — auth)
import authRoutes from "./routes/auth.routes.js";

// Layered routes (Phase 13.3 — cart + coupons)
import cartRoutes from "./routes/cart.routes.js";
import couponsRoutes from "./routes/coupons.routes.js";

// Layered routes (Phase 13.4 — orders)
import ordersRoutes from "./routes/orders.routes.js";

// Layered routes (Phase 13.5 — reviews)
import reviewsRoutes, { productReviewsRouter } from "./routes/reviews.routes.js";

// Layered routes (Phase 13.7 — favorites)
//   Phase 26 — stock-alerts router removed.
import favoritesRoutes from "./routes/favorites.routes.js";

// Layered routes (Phase 13.9 — seller, read + write)
import sellerRoutes from "./routes/seller.routes.js";

// Layered routes (Phase 13.10 — admin)
import adminRoutes from "./routes/admin.routes.js";

// Layered routes (Phase 13.11 — reference data)
// Last legacy flat router (`catalog.ts`) replaced by this layered
// module. business-types + countries — public reads driving form
// dropdowns (become-seller + register).
import referenceRoutes from "./routes/reference.routes.js";

// Layered routes (Phase 17.1 / 26 — settings, slimmed down)
// settings.routes.ts exports both the public router (default) and an
// `adminSettingsRouter` mounted under /admin. Wallet/Topup/Withdrawal
// routes were removed in Phase 26 ; payment integration moves to
// Stripe Connect in Phase 27.
import settingsRoutes, { adminSettingsRouter } from "./routes/settings.routes.js";

// Phase 14.1 — better-auth instance + Express handler bridge.
// Mounted at /auth/better/* BEFORE express.json so the request body
// reaches the handler unparsed (per better-auth Express docs).
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import helmet from "helmet";

// Middleware — order matters in the buildApp() call below.
import { corsMiddleware } from "./middleware/cors.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error.js";

export function buildApp() {
  const app = express();

  // Phase 15.1 — trust the Fly proxy's X-Forwarded-For so req.ip is
  // the real client IP, not the proxy's. The rate limiter keys on
  // req.ip; without this every limited request would share the same
  // bucket (the proxy's IP) and the limiter would block legitimate
  // traffic almost immediately. Local dev: req.ip stays 127.0.0.1
  // since there's no proxy header to consult.
  app.set("trust proxy", true);

  // Phase 22 — security headers BEFORE everything else so a 4xx from
  // a downstream middleware (cors / rate-limit / json parser) still
  // ships HSTS + X-Frame-Options + nosniff + Referrer-Policy. Helmet's
  // defaults cover those four; the CSP we set explicitly because the
  // default is `default-src 'self'` which would block better-auth's
  // Google OAuth redirect chain. The CSP shipped here trusts:
  //   - 'self' for everything
  //   - data: + blob: for inline images (avatars, slip uploads)
  //   - lh3.googleusercontent.com for Google profile pics
  //   - accounts.google.com + oauth2.googleapis.com for OAuth flow
  //   - fonts.googleapis.com / fonts.gstatic.com for the Inter font
  // The BFF (apps/web) sets its own CSP via next.config; this one
  // covers the API surface (curl + admin-tool consumption).
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
      // 180-day HSTS — browsers cache it on first HTTPS hit so even a
      // future plain-http typo gets upgraded transparently.
      hsts: { maxAge: 15_552_000, includeSubDomains: true },
      // Disable the COEP header — Next standalone build under Fly trips
      // up under Cross-Origin-Embedder-Policy: require-corp because the
      // BFF still pulls some cross-origin assets. Re-evaluate when
      // we move all assets in-house.
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 1. Logging FIRST so we always see the request even if cors / json
  //    parsing rejects it. Skipping the log when running tests would
  //    be nice but not worth the env-var dance for now.
  app.use(loggerMiddleware);
  // 2. CORS — must run before route handlers + before json so the
  //    preflight OPTIONS gets the right headers.
  app.use(corsMiddleware);

  // 3. Phase 14.1+14.2 — better-auth catch-all mounted at the same
  //    path the BFF uses (/api/auth/better/*) so OAuth callback URL
  //    generation matches what the browser actually hits. MUST be
  //    before express.json() per better-auth's Express integration
  //    docs: the handler reads the raw request body itself; if
  //    json() parsed it first the handler would hang waiting for a
  //    stream that's already been consumed.
  app.all("/api/auth/better/*", toNodeHandler(auth));

  // 4. Body + cookie parsers — every other route uses these.
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // ─── Layered routes (Phase 13.1) ──────────────────────────────────
  app.use("/health",     healthRoutes);
  app.use("/products",   productsRoutes);
  app.use("/stores",     storesRoutes);
  app.use("/categories", categoriesRoutes);
  app.use("/tags",       tagsRoutes);

  // ─── Layered routes (Phase 13.2 — auth) ──────────────────────────
  app.use("/auth",       authRoutes);

  // ─── Layered routes (Phase 13.3 — cart + coupons) ────────────────
  app.use("/cart",       cartRoutes);
  app.use("/coupons",    couponsRoutes);

  // ─── Layered routes (Phase 13.4 — orders) ────────────────────────
  app.use("/orders",     ordersRoutes);

  // ─── Layered routes (Phase 13.5 — reviews) ───────────────────────
  // Two URL families share one resource (see reviews.routes.ts).
  // POST /products/:productId/reviews mounted FIRST so it wins over
  // the products router's /:id catch-all (Express orders by mount).
  app.use("/products/:productId/reviews", productReviewsRouter);
  app.use("/reviews",    reviewsRoutes);

  // ─── Layered routes (Phase 13.7 — favorites) ────────────────────
  // Phase 26 — stock-alerts removed alongside the messaging layer.
  app.use("/favorites",    favoritesRoutes);

  // ─── Layered routes (Phase 13.9 — seller, read + write) ─────────
  // 16 endpoints total (read: store/products/stats/orders/export;
  // write: become-seller, store PATCH, product CRUD + duplicate +
  // variant nudge, coupon list/create, order status flip + refund).
  // become-seller is the one auth-only endpoint (no requireStore);
  // everything else inherits auth+store at the router level.
  app.use("/seller", sellerRoutes);

  // ─── Layered routes (Phase 13.10 — admin) ───────────────────────
  // Single role gate at the router level — every endpoint is
  // requireAuth(["admin"]). 9 endpoints across users/stores/stats/
  // transactions/reports.
  app.use("/admin", adminRoutes);

  // ─── Layered routes (Phase 13.11 — reference data) ──────────────
  // Mounted at `/` so the URLs stay GET /business-types + GET
  // /countries (matches the BFF's /api/business-types + /api/countries
  // proxies). Replaces the deleted legacy `catalog.ts` flat router.
  app.use("/", referenceRoutes);

  // ─── Layered routes (Phase 17.1 / 26 — settings) ────────────────
  // - /settings (public read) — BFF caches it
  // - /admin/settings (admin write) — flag toggles
  // The admin-scoped router mounts UNDER the existing /admin prefix
  // so it inherits the same role gate convention as the rest of
  // /admin (each individual handler still re-asserts role for safety).
  // Phase 26 dropped the wallet/topup/withdrawal routers ; Stripe
  // Connect (Phase 27) replaces the seller-payout surface.
  app.use("/settings", settingsRoutes);
  app.use("/admin",    adminSettingsRouter);

  // Service banner — useful when curl-ing the root manually.
  app.get("/", (_req, res) => {
    res.json({
      name: "METU API",
      version: "0.1.0",
      docs: "Phase 13.11 — every resource is layered, no flat routers remain",
    });
  });

  // Error handler ALWAYS LAST.
  app.use(errorHandler);

  return app;
}

// Boot only when this file is the entry, not when imported by tests.
// `pathToFileURL` handles Windows backslash + drive-letter quirks.
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
}
