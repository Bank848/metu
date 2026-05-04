import { z } from "zod";

/**
 * Stores data contracts.
 * `listQuerySchema` — validates `?limit=N` for the index endpoint.
 *  Caps at 60 so a malicious caller can't ask for the whole table.
 * Response shapes are intentionally `Record<string, unknown>` —
 * `getStore()` returns the raw Prisma row (with deep `include`)
 * because the storefront page consumes nearly every field, and
 * mirroring the Prisma type by hand would just duplicate the schema.
 */
export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional().default(20),
});
export type ListStoreQuery = z.infer<typeof listQuerySchema>;

export type StoreListResponse = Array<Record<string, unknown>>;
export type StoreDetailResponse = Record<string, unknown>;
