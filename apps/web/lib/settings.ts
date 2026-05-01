import { apiFetch, ApiError } from "./server/api";

// BFF-side settings helper. Server-side caches for 30s.
// safeGetSettings returns defaults on error.
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

export async function getSettings(): Promise<PublicSettings> {
  const data = await apiFetch<{ settings: PublicSettings }>("/settings");
  return data.settings;
}

/** Like getSettings but never throws; falls back to defaults. */
export async function safeGetSettings(): Promise<PublicSettings> {
  try {
    return await getSettings();
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return DEFAULT_SETTINGS;
  }
}
