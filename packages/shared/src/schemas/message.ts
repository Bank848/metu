import { z } from "zod";

export const sendMessageSchema = z.object({
  recipientId: z.number().int().positive(),
  body: z.string().min(1).max(1000),
  // Optional pinning to an order or product so the thread shows context.
  orderId: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
