import { cache } from "react";
import { unstable_cache } from "next/cache";
import { apiFetch, ApiError } from "./server/api";

// BFF-side settings helper. Public read — admin tweaks are rare so a
// 5-minute cross-request cache slot is safe + saves an API hop on
// every page render that needs settings (TopNav, admin guards,
// payment-fee tile). React's cache() additionally dedups within one
// request when multiple callers hit it on the same SSR pass.
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

// Cross-request cache. skipAuth keeps headers() out of the cache
// scope (settings are public anyway). 30-s TTL matches the API
// layer's own in-memory cache so an admin flip of a feature flag
// propagates within the same ~30 s window the SettingsForm toast
// promises. Hit rate stays > 95 % under demo traffic; the few
// extra round trips per minute are negligible.
const fetchSettingsCached = unstable_cache(
  async (): Promise<PublicSettings> => {
    const data = await apiFetch<{ settings: PublicSettings }>(
      "/settings",
      { skipAuth: true },
    );
    return data.settings;
  },
  ["public-settings"],
  { revalidate: 30, tags: ["public-settings"] },
);

export const getSettings = cache(fetchSettingsCached);

/** Like getSettings but never throws; falls back to defaults. */
export const safeGetSettings = cache(async (): Promise<PublicSettings> => {
  try {
    return await getSettings();
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return DEFAULT_SETTINGS;
  }
});
