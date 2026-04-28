/**
 * Express app factory + entry point.
 *
 * Phase 13.1 — restructured from the original flat `server.ts`. The
 * file now serves two purposes:
 *
 *   1. `buildApp()` returns a configured Express instance that
 *      tests can drive via `supertest(buildApp())` without binding
 *      a port.
 *   2. When this file is the module entry (`import.meta.url ===
 *      pathToFileURL(process.argv[1]).href`), it boots the listener.
 *      That guard is required because we need `buildApp()` to be
 *      importable from tests without side-effects.
 *
 * Routes are split into two groups:
 *
 *   • LAYERED (Phase 13.1 catalog migration) — products, stores,
 *     categories, tags, health. Each lives in its own
 *     `<resource>.routes.ts` → `<resource>.controller.ts` →
 *     `<resource>.service.ts` → `<resource>.model.ts` quartet.
 *
 *   • LEGACY FLAT (waiting for migration in Phase 13.2+) — auth,
 *     cart, coupons, orders, seller, admin, stats, plus the
 *     business-types + countries leftovers in `catalog.ts`. These
 *     keep working unchanged so the BFF can switch to the API
 *     server for catalog reads now and we can migrate the rest
 *     incrementally without breaking anything.
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

// Legacy flat routes that work today — will be migrated in later phases.
import { catalogRouter } from "./routes/catalog.js"; // /business-types, /countries

// NOTE — the remaining legacy flat scaffold (cart, coupons, orders,
// seller, admin, stats) is intentionally NOT imported. Those files
// reference zod schemas in @metu/shared (addToCartSchema, etc.) that
// were drafted but never finished. Each subsequent phase (13.3 cart,
// 13.4 orders, …) replaces one of them with a proper layered quartet.

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

  // ─── Legacy flat routes (still working) ──────────────────────────
  // catalogRouter is mounted at /, so the URLs stay
  // GET /business-types and GET /countries.
  app.use("/", catalogRouter);

  // Service banner — useful when curl-ing the root manually.
  app.get("/", (_req, res) => {
    res.json({
      name: "METU API",
      version: "0.1.0",
      docs: "Phase 13.1 — catalog migrated to layered structure",
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
