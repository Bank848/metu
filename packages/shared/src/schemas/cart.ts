import { z } from "zod";

export const addToCartSchema = z.object({
  productItemId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(99),
});

export const checkoutSchema = z.object({
  couponCode: z.string().max(50).optional(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
