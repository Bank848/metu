import type { RequestHandler } from "express";
import * as service from "../services/seller.service.js";
import { currentStore } from "../middleware/seller.js";
import { AppError } from "../utils/errors.js";

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
