import { prisma } from "../db/prisma.js";
import type { CategoryListResponse } from "../models/categories.model.js";

export async function findCategories(): Promise<CategoryListResponse> {
  return prisma.category.findMany({ orderBy: { categoryName: "asc" } });
}
