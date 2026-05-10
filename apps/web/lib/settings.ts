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
  /** Platform's cut (%); maps to Stripe's application_fee_amount. */
  platformFeePercent: number;
  updatedAt: string;
  /** Drives the visibility of the "Continue with Google" button. */
  googleEnabled: boolean;
}

const DEFAULT_SETTINGS: PublicSettings = {
  favoritesEnabled: true,
  platformFeePercent: 5,
  updatedAt: new Date(0).toISOString(),
  googleEnabled: false,
};

// Cross-request cache. skipAuth keeps headers() out of the cache
// scope (settings are public anyway). 5-min TTL is short enough that
// admin-flipped feature flags propagate quickly without forcing
// every page render to pay the BFF→API round trip.
const fetchSettingsCached = unstable_cache(
  async (): Promise<PublicSettings> => {
    const data = await apiFetch<{ settings: PublicSettings }>(
      "/settings",
      { skipAuth: true },
    );
    return data.settings;
  },
  ["public-settings"],
  { revalidate: 300, tags: ["public-settings"] },
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
