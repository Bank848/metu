import { z } from "zod";
import { DELIVERY_METHOD } from "../enums.js";

export const browseQuerySchema = z.object({
  category: z.coerce.number().int().positive().optional(),
  // Comma-separated tag ids — only digits + commas. Earlier rev was
  // `z.string().optional()` which accepted anything; the service layer
  // then did `tags.split(",").map(Number).filter(Boolean)` and silently
  // dropped non-numeric tokens. Net effect: a typo'd `?tags=foo,3`
  // showed all products in tag 3 (correct) but `?tags=foo,bar` showed
  // ALL products with no warning. Tightening the regex catches typos
  // at the schema layer.
  tags: z.string().regex(/^\d+(,\d+)*$/, "tags must be comma-separated ids").optional(),
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
  name: z.string().max(100), 
  description: z.string().max(255).nullable(),
  image: z.string().nullable(),
  quantity: z.number().int().min(0).nullable().optional(),
  deliveryMethod: z.enum(DELIVERY_METHOD),
  // .nonnegative() allows ฿0 ("free") variants — checkout skips
  // Stripe + auto-fulfils when the whole order total is 0.
  price: z.number().nonnegative(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  discountAmount: z.number().nonnegative().default(0),
  deliveryUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  licenseKeyTemplate: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9\-_]+$/, "Use letters, digits, hyphens, or underscores only")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const productAddDetailInputSchema = z.object({
  detailName: z.string().max(100),
  detailValue: z.string().max(200),
});

export const productInputSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(255),
  categoryId: z.number().int().positive(),
  images: z.array(z.string().url()).min(1).max(5),
  // Free-form tag names. Server resolves to existing ProductTag rows
  // case-insensitively; unknown names auto-create.
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  items: z.array(productItemInputSchema).min(1).max(5),
  isStackable: z.boolean().optional(),
  details: z.array(productAddDetailInputSchema).max(6).default([]),
});

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(255),
});

export const reviewEditSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).max(255).optional(),
});

export type BrowseQuery = z.infer<typeof browseQuerySchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductItemInput = z.infer<typeof productItemInputSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ReviewEditInput = z.infer<typeof reviewEditSchema>;

