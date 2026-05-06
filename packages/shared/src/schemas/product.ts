import { z } from "zod";
import { DELIVERY_METHOD } from "../enums.js";

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
  // Private post-purchase link sent to the buyer once Stripe confirms
  // payment. Only meaningful for download / streaming methods; the
  // controller leaves it null otherwise.
  deliveryUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Optional license-key template; XXXX runs are replaced with random
  // alphanumerics at delivery time. Falls back to a UUID when blank.
  licenseKeyTemplate: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9\-_]+$/, "Use letters, digits, hyphens, or underscores only")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

// CPE241 Business Rule 4g — up to 7 freeform key/value pairs per
// product. detailName is the label (e.g. "File format", "License"),
// detailValue is the data (e.g. "PNG/JPG", "Personal use only"). The
// existing ProductDetail Prisma model already maps to product_detail.
export const productAddDetailInputSchema = z.object({
  detailName: z.string().min(1).max(80),
  detailValue: z.string().min(1).max(255),
});

export const productInputSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(255),
  categoryId: z.number().int().positive(),
  images: z.array(z.string().url()).min(1).max(5),
  tagIds: z.array(z.number().int().positive()).max(10).default([]),
  items: z.array(productItemInputSchema).min(1).max(5),
  // Phase 48 — when false, buyers can't re-purchase the same product.
  // Sellers leave undefined → seller.service.createProduct picks a
  // default based on the first variant's delivery method
  // (license_key → true, others → false).
  isStackable: z.boolean().optional(),
  // CPE241 Business Rule 4g — up to 7 freeform key/value rows.
  details: z.array(productAddDetailInputSchema).max(7).default([]),
});

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(255),
});

/**
 * Partial-edit shape for PATCH /reviews/:id (admin moderation OR the
 * review's author). Both fields optional — the controller rejects
 * 400 if BOTH end up undefined (no-op edits aren't useful).
 */
export const reviewEditSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).max(255).optional(),
});

export type BrowseQuery = z.infer<typeof browseQuerySchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductItemInput = z.infer<typeof productItemInputSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ReviewEditInput = z.infer<typeof reviewEditSchema>;
