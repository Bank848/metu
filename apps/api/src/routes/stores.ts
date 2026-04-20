import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const storesRouter = Router();

storesRouter.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 60);
    const stores = await prisma.store.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        businessType: true,
        stats: true,
        _count: { select: { products: true } },
      },
    });
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

storesRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const store = await prisma.store.findUnique({
      where: { storeId: id },
      include: {
        owner: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
        businessType: true,
        stats: true,
        products: {
          include: {
            items: { select: { price: true, discountPercent: true } },
            images: { take: 1, orderBy: { sortOrder: "asc" } },
            reviews: { select: { rating: true } },
          },
        },
      },
    });
    if (!store) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    res.json(store);
  } catch (err) {
    next(err);
  }
});
