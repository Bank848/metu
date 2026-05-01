// Favorites resource response shapes. Both POST and DELETE take
// productId from the URL only, so there's no zod input schema here.

export interface FavoriteToggleResponse {
  ok: true;
  favorited: boolean;
}

export interface FavoriteListResponse {
  productIds: number[];
}
