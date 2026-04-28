import type { Category } from "@prisma/client";

/**
 * Categories are static reference data (~10 rows). The list endpoint
 * returns the raw Prisma rows alphabetically — no filter, no pagination.
 */
export type CategoryListResponse = Category[];
