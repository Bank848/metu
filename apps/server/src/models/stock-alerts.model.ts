/**
 * Phase 13.7 — stock alerts resource DTOs.
 *
 * Same shape as favorites: only the URL parameter (productItemId)
 * matters; no request body. Future enhancement (digest preferences,
 * notification channel) would add a body schema here.
 */

export interface StockAlertToggleResponse {
  ok: true;
  subscribed: boolean;
}
