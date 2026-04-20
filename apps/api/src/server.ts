import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { healthRouter } from "./routes/health.js";
import { statsRouter } from "./routes/stats.js";
import { productsRouter } from "./routes/products.js";
import { storesRouter } from "./routes/stores.js";
import { catalogRouter } from "./routes/catalog.js";
import { authRouter } from "./routes/auth.js";
import { cartRouter } from "./routes/cart.js";
import { couponsRouter } from "./routes/coupons.js";
import { ordersRouter } from "./routes/orders.js";
import { sellerRouter } from "./routes/seller.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const PORT = Number(process.env.API_PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(morgan("dev"));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/health", healthRouter);
app.use("/stats", statsRouter);
app.use("/auth", authRouter);
app.use("/products", productsRouter);
app.use("/stores", storesRouter);
app.use("/cart", cartRouter);
app.use("/coupons", couponsRouter);
app.use("/orders", ordersRouter);
app.use("/seller", sellerRouter);
app.use("/admin", adminRouter);
app.use("/", catalogRouter); // /categories, /tags, /business-types, /countries

app.get("/", (_req, res) => {
  res.json({
    name: "METU API",
    version: "0.1.0",
    docs: "Phase 1 scaffold — routes expand in later phases",
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "InternalServerError", message: err.message });
});

app.listen(PORT, () => {
  console.log(`[metu-api] listening on http://localhost:${PORT}`);
  console.log(`[metu-api] CORS origin: ${CORS_ORIGIN}`);
});
