import { z } from "zod";

// Client-side cap is generous — the server enforces the real cap based on
// productItem.quantity (stock) and deliveryMethod (digital → 1).
export const addToCartSchema = z.object({
  productItemId: z.number().int().positive(),
  quantity: z.number().int().positive().max(999).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(999),
});

export const checkoutSchema = z.object({
  couponCode: z.string().max(50).optional(),
  // Undefined = check out ALL items. Array = partial checkout; unchecked
  // items stay in the user's new active cart.
  selectedCartItemIds: z.array(z.number().int().positive()).optional(),
  // Gift options — when present the order is flagged for gift display.
  giftRecipientEmail: z.string().email().max(80).optional(),
  giftMessage: z.string().max(500).optional(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
