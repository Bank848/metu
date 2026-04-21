import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "alphanumeric + underscore only"),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  countryId: z.number().int().positive().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // ISO date string from <input type="date"> — converted to Date in the API.
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(40).optional(),
  lastName: z.string().min(1).max(40).optional(),
  email: z.string().email().optional(),
  profileImage: z.string().url().optional(),
  countryId: z.number().int().positive().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
