/**
 * Phase 17.1 / 26 — system settings DTOs (slimmed down).
 *
 * The settings row is a single Postgres row with two runtime
 * configuration fields after Phase 26's trim:
 *   - favoritesEnabled (feature flag for the wishlist surface)
 *   - platformFeePercent (used by Stripe `application_fee_amount`
 *                         from Phase 27 onward)
 */
import { z } from "zod";

export interface PublicSettings {
  /** Phase 17.x — favourites surfaces hide when false. */
  favoritesEnabled: boolean;
  /**
   * Phase 20.1 / 26 — % the platform keeps from every order subtotal.
   * Default 5 means sellers earn 95% of each sale. Phase 27 wires
   * this into Stripe's `application_fee_amount` parameter.
   */
  platformFeePercent: number;
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
  favoritesEnabled: z.boolean().optional(),
  // Phase 20.1 — fractional percents allowed (e.g. 5.5%). 0–100 range
  // so the schema can never produce a negative cut or > 100% fee.
  platformFeePercent: z.number().min(0).max(100).optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
