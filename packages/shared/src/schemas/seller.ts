import { z } from "zod";
import { ORDER_STATUS } from "../enums";

export const becomeSellerSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().min(2).max(255),
  businessTypeId: z.number().int().positive(),
  profileImage: z.string().url().optional(),
  coverImage: z.string().url().optional(),
});

export const updateStoreSchema = becomeSellerSchema.partial();

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS),
});

export type BecomeSellerInput = z.infer<typeof becomeSellerSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
