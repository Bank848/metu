import { apiFetch, ApiError } from "./server/api";

/**
 * Phase 17.1 — BFF-side settings helper.
 *
 * Server components call this to read the live feature flags. The
 * Express side already caches in-memory for 30 s, so calling this
 * on every render is cheap (~5 ms warm). Callers can also use the
 * `safeGetSettings` variant which returns sensible defaults on
 * any error so a transient API outage doesn't kill page rendering.
 *
 * Example:
 *   const { walletEnabled, chatEnabled } = await getSettings();
 *   if (!chatEnabled) return null;
 */
export interface PublicSettings {
  walletEnabled: boolean;
  chatEnabled: boolean;
  /** Phase 17.x — favourites surfaces hide when false. */
  favoritesEnabled: boolean;
  promptpayId: string;
  /** Phase 20.1 — % the platform keeps from each store-line subtotal at
   *  credit time (default 5 = sellers earn 95%). Surfaced publicly so
   *  the cart UI can preview the effective fee at checkout. */
  platformFeePercent: number;
  /** Phase 20.1 — % deducted from a withdrawal request's amountCoins.
   *  Default 0. Surfaced publicly so the seller's withdrawal request
   *  form can preview the net payout. */
  withdrawalFeePercent: number;
  updatedAt: string;
  /** Phase 17.x — true only when GOOGLE_CLIENT_ID is set on the API.
   *  LoginForm hides the "Continue with Google" button when false so
   *  users don't get a 404 / PROVIDER_NOT_FOUND on click. */
  googleEnabled: boolean;
}

const DEFAULT_SETTINGS: PublicSettings = {
  walletEnabled: false,
  chatEnabled: true,
  favoritesEnabled: true,
  promptpayId: "",
  platformFeePercent: 5,
  withdrawalFeePercent: 0,
  updatedAt: new Date(0).toISOString(),
  googleEnabled: false,
};

export async function getSettings(): Promise<PublicSettings> {
  const data = await apiFetch<{ settings: PublicSettings }>("/settings");
  return data.settings;
}

/** Same as getSettings but never throws — falls back to safe defaults. */
export async function safeGetSettings(): Promise<PublicSettings> {
  try {
    return await getSettings();
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return DEFAULT_SETTINGS;
  }
}
