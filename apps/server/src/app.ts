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

// Layered routes (Phase 13.6 — q&a)
import qnaRoutes, { productQuestionsRouter } from "./routes/qna.routes.js";

// Layered routes (Phase 13.7 — favorites + stock alerts)
import favoritesRoutes from "./routes/favorites.routes.js";
import stockAlertsRoutes from "./routes/stock-alerts.routes.js";

// Layered routes (Phase 13.8 — messages)
import messagesRoutes from "./routes/messages.routes.js";

// Layered routes (Phase 13.9 — seller, read + write)
import sellerRoutes from "./routes/seller.routes.js";

// Layered routes (Phase 13.10 — admin)
import adminRoutes from "./routes/admin.routes.js";

// Layered routes (Phase 13.11 — reference data)
// Last legacy flat router (`catalog.ts`) replaced by this layered
// module. business-types + countries — public reads driving form
// dropdowns (become-seller + register).
import referenceRoutes from "./routes/reference.routes.js";

// Middleware — order matters in the buildApp() call below.
import { corsMiddleware } from "./middleware/cors.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error.js";

export function buildApp() {
  const app = express();

  // 1. Logging FIRST so we always see the request even if cors / json
  //    parsing rejects it. Skipping the log when running tests would
  //    be nice but not worth the env-var dance for now.
  app.use(loggerMiddleware);
  // 2. CORS — must run before route handlers + before json so the
  //    preflight OPTIONS gets the right headers.
  app.use(corsMiddleware);
  // 3. Body + cookie parsers.
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

  // ─── Layered routes (Phase 13.6 — q&a) ───────────────────────────
  // Same two-router shape as reviews. /questions/:id/answer is
  // declared on the default router so it shares the /questions
  // mount prefix.
  app.use("/products/:productId/questions", productQuestionsRouter);
  app.use("/questions",  qnaRoutes);

  // ─── Layered routes (Phase 13.7 — favorites + stock alerts) ─────
  // Two single-router resources. Both auth-only; idempotent toggle
  // semantics on the join tables (ProductFavorite, StockAlert).
  app.use("/favorites",    favoritesRoutes);
  app.use("/stock-alerts", stockAlertsRoutes);

  // ─── Layered routes (Phase 13.8 — messages) ─────────────────────
  // GET /messages (inbox + thread via ?with=N), GET /messages/unread,
  // POST /messages. All auth-only. Postgres-only path for now;
  // future MongoDB sidecar would swap services/messages.service.ts.
  app.use("/messages", messagesRoutes);

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
