import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const statsRouter = Router();

// Landing-page counters: Sellers, Products, Orders, Reviews
statsRouter.get("/", async (_req, res, next) => {
  try {
    const [sellers, products, orders, reviews] = await Promise.all([
      prisma.userStats.count({ where: { role: "seller" } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.productReview.count(),
    ]);

    res.json({ sellers, products, orders, reviews });
  } catch (err) {
    next(err);
  }
});
