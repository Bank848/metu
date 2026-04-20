import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const catalogRouter = Router();

catalogRouter.get("/categories", async (_req, res, next) => {
  try {
    const data = await prisma.category.findMany({ orderBy: { categoryName: "asc" } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/tags", async (_req, res, next) => {
  try {
    const data = await prisma.productTag.findMany({ orderBy: { tagName: "asc" } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/business-types", async (_req, res, next) => {
  try {
    const data = await prisma.businessType.findMany({ orderBy: { name: "asc" } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/countries", async (_req, res, next) => {
  try {
    const data = await prisma.country.findMany({ orderBy: { name: "asc" } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});
