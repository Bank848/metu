import { apiFetch, ApiError } from "./server/api";

/**
 * Phase 17.1 / 26 — BFF-side settings helper (slimmed down).
 *
 * Server components call this to read the live feature flags. The
 * Express side already caches in-memory for 30 s, so calling this
 * on every render is cheap (~5 ms warm). Callers can also use the
 * `safeGetSettings` variant which returns sensible defaults on
 * any error so a transient API outage doesn't kill page rendering.
 *
 * Phase 26 dropped: walletEnabled, chatEnabled, promptpayId,
 * withdrawalFeePercent (PromptPay/coin layer removed in favour of
 * Stripe Connect, scheduled for Phase 27).
 *
 * Example:
 *   const { favoritesEnabled } = await getSettings();
 *   if (!favoritesEnabled) return null;
 */
export interface PublicSettings {
  /** Phase 17.x — favourites surfaces hide when false. */
  favoritesEnabled: boolean;
  /** Phase 20.1 / 26 — % the platform keeps from each order. Phase 27
   *  wires this into Stripe's `application_fee_amount` parameter. */
  platformFeePercent: number;
  updatedAt: string;
  /** Phase 17.x — true only when GOOGLE_CLIENT_ID is set on the API.
   *  LoginForm hides the "Continue with Google" button when false so
   *  users don't get a 404 / PROVIDER_NOT_FOUND on click. */
  googleEnabled: boolean;
}

const DEFAULT_SETTINGS: PublicSettings = {
  favoritesEnabled: true,
  platformFeePercent: 5,
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
