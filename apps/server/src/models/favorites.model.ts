/**
 * Phase 13.7 — favorites resource DTOs.
 *
 * Both POST and DELETE take only `productId` from the URL — no
 * request body — so there's no zod input schema here. The shape
 * below is what the controller serialises back to the BFF.
 */

export interface FavoriteToggleResponse {
  ok: true;
  favorited: boolean;
}

export interface FavoriteListResponse {
  productIds: number[];
}
