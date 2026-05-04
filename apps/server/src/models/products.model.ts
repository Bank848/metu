/**
 * Products data contracts — what crosses the network for the
 * `/products`, `/products/featured`, `/products/:id` endpoints.
 * Request validation reuses the `browseQuerySchema` already defined
 * in `@metu/shared` (single source of truth: client form + server
 * validation read the same zod schema). Response shapes are TS
 * interfaces — controllers shape Prisma rows into these before
 * `res.json()`.
 */
export { browseQuerySchema, type BrowseQuery } from "@metu/shared";

export interface ProductListItem {
  productId: number;
  name: string;
  description: string;
  image: string;
  minPrice: number;
  maxPrice: number;
  storeName: string;
  storeId: number;
  avgRating?: number;
  reviewCount: number;
  discountPercent?: number;
  tags: string[];
}

export interface ProductBrowseResponse {
  items: ProductListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Product detail returns the raw Prisma row PLUS aggregated rating
 * fields. We don't lock down the field list here because the detail
 * page consumes nearly every column — typing it as `unknown extends`
 * the Prisma type would just duplicate the schema.
 */
export type ProductDetailResponse = Record<string, unknown> & {
  avgRating?: number;
  reviewCount: number;
};
