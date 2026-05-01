// System settings DTOs.
import { z } from "zod";

export interface PublicSettings {
  favoritesEnabled: boolean;
  /** Platform's cut (%); maps to Stripe's application_fee_amount. */
  platformFeePercent: number;
  updatedAt: Date;
  /** True when GOOGLE_CLIENT_ID + BETTER_AUTH_URL are both set. */
  googleEnabled: boolean;
}

export const settingsPatchSchema = z.object({
  favoritesEnabled: z.boolean().optional(),
  // Fractional percents allowed (e.g. 5.5%).
  platformFeePercent: z.number().min(0).max(100).optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
