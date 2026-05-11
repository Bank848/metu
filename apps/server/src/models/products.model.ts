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
  /** Live seller level (1-5) from v_user_level — display-only. */
  sellerLevel?: number;
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

export type ProductDetailResponse = Record<string, unknown> & {
  avgRating?: number;
  reviewCount: number;
};
