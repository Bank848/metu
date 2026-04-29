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
