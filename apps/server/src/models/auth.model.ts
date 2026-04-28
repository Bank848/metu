/**
 * Auth data contracts.
 *
 * Request schemas come from `@metu/shared` so the BFF form components
 * AND the API parse with the same zod definition. Response shapes are
 * TS interfaces — controllers shape Prisma rows into these.
 */
export {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SetPasswordInput,
} from "@metu/shared";

import type { User, UserStats } from "@prisma/client";

/**
 * The "safe" user shape — strips the bcrypt hash from `User`. Returned
 * by every auth endpoint that emits the current user (login, register,
 * /me, PATCH /me).
 */
export type SafeUser = Omit<User, "password"> & {
  stats?: UserStats | null;
};

export interface AuthResponse {
  user: SafeUser;
}

export interface MeResponse {
  user: SafeUser;
  role: "buyer" | "seller" | "admin";
}
