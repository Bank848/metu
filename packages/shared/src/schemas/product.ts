import { z } from "zod";
import { DELIVERY_METHOD } from "../enums";

export const browseQuerySchema = z.object({
  category: z.coerce.number().int().positive().optional(),
  tags: z.string().optional(), // comma-separated tag ids
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  delivery: z.enum(DELIVERY_METHOD).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating"]).default("newest"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(60).default(12),
});

export const productItemInputSchema = z.object({
  deliveryMethod: z.enum(DELIVERY_METHOD),
  quantity: z.number().int().nonnegative().default(0),
  price: z.number().positive(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  discountAmount: z.number().nonnegative().default(0),
  // Optional public URL of a free preview / sample (PDF, audio clip, etc.)
  // Empty string is normalised to undefined so Prisma stores NULL.
  sampleUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const productInputSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(255),
  categoryId: z.number().int().positive(),
  images: z.array(z.string().url()).min(1).max(5),
  tagIds: z.array(z.number().int().positive()).max(10).default([]),
  items: z.array(productItemInputSchema).min(1).max(5),
});

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(255),
});

export type BrowseQuery = z.infer<typeof browseQuerySchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductItemInput = z.infer<typeof productItemInputSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
