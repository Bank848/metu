import { cache } from "react";
import { apiFetch, ApiError } from "./server/api";

// BFF-side settings helper. Public read — kept on React's per-request
// cache() only so multiple callers on the same SSR pass (TopNav +
// admin guard + cart page) share one /settings round trip, but
// admin flag flips are visible on the very next page render. The
// previous unstable_cache wrap was buying ~30 s of extra hit-rate
// at the cost of a 5-min stale window after admin saves — not
// worth it for a flag-driven UX where "instant" matters.
export interface PublicSettings {
  favoritesEnabled: boolean;
  /** Gates the "🎁 This is a gift" checkout path platform-wide. */
  giftingEnabled: boolean;
  /** Platform's cut (%); maps to Stripe's application_fee_amount. */
  platformFeePercent: number;
  updatedAt: string;
  /** Drives the visibility of the "Continue with Google" button. */
  googleEnabled: boolean;
}

const DEFAULT_SETTINGS: PublicSettings = {
  favoritesEnabled: true,
  giftingEnabled: true,
  platformFeePercent: 5,
  updatedAt: new Date(0).toISOString(),
  googleEnabled: false,
};

export const getSettings = cache(async (): Promise<PublicSettings> => {
  const data = await apiFetch<{ settings: PublicSettings }>(
    "/settings",
    { skipAuth: true },
  );
  return data.settings;
});

/** Like getSettings but never throws; falls back to defaults. */
export const safeGetSettings = cache(async (): Promise<PublicSettings> => {
  try {
    return await getSettings();
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return DEFAULT_SETTINGS;
  }
});
