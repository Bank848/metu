import { prisma } from "../db/prisma.js";
import type { TagListResponse } from "../models/tags.model.js";

// LEFT JOIN so tags with no products surface with productCount = 0.
// Sorted by count desc so the autocomplete dropdown shows popular tags
// first; alphabetical tie-break keeps the order stable for Cypress runs.
export async function findTags(): Promise<TagListResponse> {
  const rows = await prisma.$queryRaw<Array<{
    tag_id: number;
    tag_name: string;
    tag_description: string;
    product_count: number;
  }>>`
    SELECT pt.tag_id, pt.tag_name, pt.tag_description,
           COALESCE(COUNT(pnt.product_id), 0)::int AS product_count
      FROM product_tag pt
      LEFT JOIN product_n_tag pnt ON pnt.tag_id = pt.tag_id
     GROUP BY pt.tag_id, pt.tag_name, pt.tag_description
     ORDER BY product_count DESC, pt.tag_name ASC
  `;
  return rows.map((r) => ({
    tagId: r.tag_id,
    tagName: r.tag_name,
    tagDescription: r.tag_description,
    productCount: Number(r.product_count),
  }));
}
