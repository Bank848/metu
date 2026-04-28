import { prisma } from "../db/prisma.js";
import type { TagListResponse } from "../models/tags.model.js";

export async function findTags(): Promise<TagListResponse> {
  return prisma.productTag.findMany({ orderBy: { tagName: "asc" } });
}
