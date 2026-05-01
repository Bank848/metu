import type { RequestHandler } from "express";
import * as service from "../services/seller.service.js";
import { currentStore } from "../middleware/seller.js";
import { currentAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import {
  becomeSellerSchema,
  updateStoreSchema,
  productInputSchema,
  couponInputSchema,
  patchVariantSchema,
  updateOrderStatusSchema,
} from "../models/seller.model.js";

/**
 * GET /seller/store — current seller's store w/ businessType + stats.
 * Auth + requireStore() already validated by the router middleware
 * chain, so currentStore() is non-null here.
 */
export const getStore: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const full = await service.getStore(store.storeId);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

/** GET /seller/products — list seller's live products. */
export const listProducts: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const products = await service.listProducts(store.storeId);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

/** GET /seller/products/:id — single product (full edit-form data). */
export const getProduct: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    const product = await service.getProduct(productId, store.storeId);
    res.json(product);
  } catch (err) {
    next(err);
  }
};

/** GET /seller/stats — analytics dashboard payload. */
export const getStats: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const stats = await service.getStats(store.storeId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

/** GET /seller/orders?status= — orders containing the seller's lines. */
export const listOrders: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const orders = await service.listOrders(store.storeId, status);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /seller/orders/export — CSV download. Sets Content-Type +
 * Content-Disposition so the browser downloads instead of inlining.
 */
export const exportOrders: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const csv = await service.exportOrdersCsv(store.storeId);
    const filename = `metu-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /seller/become-seller. Auth only - the user has no store yet.
 * Mounted before the router.use(requireStore) line.
 */
export const becomeSeller: RequestHandler = async (req, res, next) => {
  try {
    const auth = currentAuth(req);
    if (!auth) throw new AppError(401, "Unauthorized");
    const parsed = becomeSellerSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    const store = await service.becomeSeller(auth.uid, parsed.data);
    res.json(store);
  } catch (err) {
    next(err);
  }
};

/** PATCH /seller/store — partial update. */
export const updateStore: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const parsed = updateStoreSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    const result = await service.updateStore(store.storeId, parsed.data);
    if (result.noop) {
      res.json({ ok: true, noop: true });
      return;
    }
    res.json({ ok: true, store: result.store });
  } catch (err) {
    next(err);
  }
};

/** POST /seller/products — create. */
export const createProduct: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const parsed = productInputSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    const product = await service.createProduct(store.storeId, parsed.data);
    res.json(product);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /seller/products/:id — fast-path { isActive } OR full edit.
 * Ownership pre-check (404 vs 403) before either path.
 */
export const updateProduct: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    await service.assertProductOwnership(productId, store.storeId);

    const body = req.body ?? {};
    // Pause-toggle fast path: pure { isActive: boolean }.
    if (typeof body?.isActive === "boolean" && Object.keys(body).length === 1) {
      const r = await service.updateProduct(productId, store.storeId, body);
      res.json({ ok: true, isActive: (r as { isActive: boolean }).isActive });
      return;
    }
    const parsed = productInputSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    await service.updateProduct(productId, store.storeId, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** DELETE /seller/products/:id — soft-delete + audit row. */
export const deleteProduct: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const store = currentStore(req);
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId)) throw new AppError(400, "BadId");
    const product = await service.assertProductOwnership(productId, store.storeId);
    await service.deleteProduct(productId, store.storeId, auth.uid, product.name);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /seller/products/:id/duplicate — clone (paused). */
export const duplicateProduct: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const sourceId = Number(req.params.id);
    if (!Number.isFinite(sourceId)) throw new AppError(400, "BadId");
    const created = await service.duplicateProduct(sourceId, store.storeId);
    res.json({ ok: true, productId: created.productId });
  } catch (err) {
    next(err);
  }
};

/** PATCH /seller/product-items/:id — targeted variant nudge. */
export const patchVariant: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const productItemId = Number(req.params.id);
    if (!Number.isFinite(productItemId)) throw new AppError(400, "BadId");
    const parsed = patchVariantSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    const productItem = await service.patchVariant(productItemId, store.storeId, parsed.data);
    res.json({ ok: true, productItem });
  } catch (err) {
    next(err);
  }
};

/** GET /seller/coupons — list. */
export const listCoupons: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const coupons = await service.listCoupons(store.storeId);
    res.json(coupons);
  } catch (err) {
    next(err);
  }
};

/** POST /seller/coupons — create. */
export const createCoupon: RequestHandler = async (req, res, next) => {
  try {
    const store = currentStore(req);
    const parsed = couponInputSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    const created = await service.createCoupon(store.storeId, parsed.data);
    res.json(created);
  } catch (err) {
    next(err);
  }
};

/** PATCH /seller/orders/:id — flip status (fulfilled / cancelled). */
export const updateOrderStatus: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const store = currentStore(req);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) throw new AppError(400, "BadId");
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "ValidationError", parsed.error.message);
    await service.updateOrderStatus(orderId, store.storeId, auth.uid, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** POST /seller/orders/:id/refund — refund + transaction in one tx. */
export const refundOrder: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const store = currentStore(req);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) throw new AppError(400, "BadId");
    await service.refundOrder(orderId, store.storeId, auth.uid);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
