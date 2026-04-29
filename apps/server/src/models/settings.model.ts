/**
 * Phase 17.1 — system settings DTOs.
 *
 * The settings table is a single row with three boolean/string
 * runtime feature flags. Read-side returns the current values;
 * write-side accepts a partial patch (admin only).
 */
import { z } from "zod";

export interface PublicSettings {
  walletEnabled: boolean;
  chatEnabled: boolean;
  promptpayId: string;
  updatedAt: Date;
  /**
   * Phase 17.x — derived (not stored) flag that's `true` when the
   * server has GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET configured
   * AND a BETTER_AUTH_URL set. The LoginForm reads this so the
   * "Continue with Google" button stays HIDDEN on deployments where
   * the OAuth credentials weren't provisioned (otherwise clicking
   * the button takes the user to a hard 404 / PROVIDER_NOT_FOUND
   * with no UX indication of what went wrong).
   */
  googleEnabled: boolean;
}

export const settingsPatchSchema = z.object({
  walletEnabled: z.boolean().optional(),
  chatEnabled: z.boolean().optional(),
  promptpayId: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "PromptPay ID must be a 10–15 digit phone or national ID")
    .optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
