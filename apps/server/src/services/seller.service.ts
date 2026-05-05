import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import { refundOrder as stripeRefund } from "./stripe.service.js";
import {
  type SellerStatsResponse,
  type PatchVariantInput,
  type UpdateOrderStatusInput,
  type becomeSellerSchema,
  type updateStoreSchema,
  type productInputSchema,
  type couponInputSchema,
} from "../models/seller.model.js";

type BecomeSellerInput = z.infer<typeof becomeSellerSchema>;
type UpdateStoreInput  = z.infer<typeof updateStoreSchema>;
type ProductInput      = z.infer<typeof productInputSchema>;
type CouponInput       = z.infer<typeof couponInputSchema>;

// Seller service. Functions take a storeId rather than reaching for
// the request, keeping them testable in isolation.

/** Current seller's store with businessType. */
export async function getStore(storeId: number) {
  return prisma.store.findUnique({
    where: { storeId },
    include: { businessType: true },
  });
}

/**
 * List the seller's live products (deletedAt:null) — soft-deleted
 * rows stay out of the dashboard. Admin /admin/audit can still see
 * them via the audit log.
 */
export async function listProducts(storeId: number) {
  return prisma.product.findMany({
    where: { storeId, deletedAt: null },
    orderBy: { productId: "desc" },
    include: {
      category: true,
      items: { orderBy: { price: "asc" } },
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      _count: { select: { reviews: true } },
    },
  });
}

/**
 * Single product, scoped to the seller's store. Throws 404 if the
 * product doesn't exist, 403 if it belongs to a different store.
 * The two errors are deliberately distinct so the dashboard UI can
 * tell them apart (404 = stale link; 403 = bug or attempt).
 */
export async function getProduct(productId: number, storeId: number) {
  const product = await prisma.product.findUnique({
    where: { productId },
    include: {
      category: true,
      items: { orderBy: { productItemId: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
    },
  });
  if (!product) throw new AppError(404, "NotFound");
  if (product.storeId !== storeId) throw new AppError(403, "Forbidden");
  return product;
}

/**
 * Analytics dashboard payload. Five queries fan out in parallel
 * because they touch different tables; the two raw aggregates +
 * top-products query stay serial because they hit overlapping
 * indexes and bursts hurt Neon's free tier.
 */
export async function getStats(storeId: number): Promise<SellerStatsResponse> {
  const [store, productCount, recentReviews, totals] = await Promise.all([
    prisma.store.findUnique({
      where: { storeId },
      include: { businessType: true },
    }),
    prisma.product.count({ where: { storeId, deletedAt: null } }),
    prisma.productReview.findMany({
      where: { product: { storeId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { firstName: true, lastName: true, profileImage: true } },
        product: { select: { name: true, productId: true } },
      },
    }),
    prisma.$queryRaw<
      Array<{
        paid_count: bigint;
        total_revenue: string | null;
        fulfilled_count: bigint;
        pending_count: bigint;
      }>
    >`
      SELECT
        COUNT(DISTINCT CASE WHEN o.status IN ('paid','fulfilled') THEN o.order_id END)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN o.status IN ('paid','fulfilled') THEN oi.price_per_unit * oi.quantity END), 0)::text AS total_revenue,
        COUNT(DISTINCT CASE WHEN o.status = 'fulfilled' THEN o.order_id END)::bigint AS fulfilled_count,
        COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.order_id END)::bigint AS pending_count
      FROM order_item oi
      JOIN product_item pi ON pi.product_item_id = oi.product_item_id
      JOIN product p ON p.product_id = pi.product_id
      JOIN orders o ON o.order_id = oi.order_id
      WHERE p.store_id = ${storeId}
    `,
  ]);

  const dailyOrders = await prisma.$queryRaw<
    Array<{ day: Date; count: bigint }>
  >`
    SELECT DATE_TRUNC('day', o.created_at)::date AS day, COUNT(DISTINCT o.order_id)::bigint AS count
    FROM orders o
    JOIN order_item oi ON oi.order_id = o.order_id
    JOIN product_item pi ON pi.product_item_id = oi.product_item_id
    JOIN product p ON p.product_id = pi.product_id
    WHERE p.store_id = ${storeId}
      AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day
  `;

  const topProducts = await prisma.$queryRaw<
    Array<{ product_id: number; name: string; revenue: string; units: bigint }>
  >`
    SELECT p.product_id, p.name,
           COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue,
           COALESCE(SUM(oi.quantity), 0)::bigint AS units
    FROM product p
    LEFT JOIN product_item pi ON pi.product_id = p.product_id
    LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
    WHERE p.store_id = ${storeId}
    GROUP BY p.product_id, p.name
    ORDER BY revenue DESC
    LIMIT 5
  `;

  return {
    store,
    productCount,
    kpi: {
      paidCount: Number(totals[0]?.paid_count ?? 0),
      totalRevenue: Number(totals[0]?.total_revenue ?? 0),
      fulfilledCount: Number(totals[0]?.fulfilled_count ?? 0),
      pendingCount: Number(totals[0]?.pending_count ?? 0),
    },
    dailyOrders: dailyOrders.map((r) => ({
      day: r.day,
      count: Number(r.count),
    })),
    topProducts: topProducts.map((r) => ({
      productId: r.product_id,
      name: r.name,
      revenue: Number(r.revenue),
      units: Number(r.units),
    })),
    recentReviews,
  };
}

/**
 * Orders the seller should care about — every order containing at
 * least one line from their store. Optional ?status filter passes
 * through to Prisma's enum check.
 * Scoped sub-includes: nested `items` only resolve to lines for THIS
 * store so we don't leak details about competitors' products if the
 * order is multi-store.
 */
export async function listOrders(storeId: number, status?: string) {
  return prisma.order.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      items: {
        some: { productItem: { product: { storeId } } },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
      items: {
        where: { productItem: { product: { storeId } } },
        include: {
          productItem: {
            include: {
              product: {
                select: {
                  name: true,
                  productId: true,
                  images: { take: 1, orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      },
      transaction: true,
    },
  });
}

/**
 * CSV export — same dataset as listOrders but flattened into one
 * row per (order, line item). Returns the CSV body as a string;
 * the controller adds the Content-Type / Content-Disposition headers.
 */
export async function exportOrdersCsv(storeId: number): Promise<string> {
  const orders = await prisma.order.findMany({
    where: {
      items: { some: { productItem: { product: { storeId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        include: {
          productItem: {
            include: { product: { select: { storeId: true, name: true } } },
          },
        },
      },
    },
  });

  const header = [
    "order_id",
    "order_date",
    "order_status",
    "order_total",
    "buyer_username",
    "buyer_name",
    "buyer_email",
    "product_name",
    "delivery_method",
    "quantity",
    "unit_price",
    "line_subtotal",
  ];
  const rows: string[] = [header.join(",")];

  for (const o of orders) {
    for (const li of o.items) {
      // Skip lines belonging to OTHER stores — order may be multi-store.
      if (li.productItem.product.storeId !== storeId) continue;
      const subtotal = Number(li.pricePerUnit) * li.quantity;
      const cells = [
        o.orderId,
        o.createdAt.toISOString(),
        o.status,
        Number(o.totalPrice).toFixed(2),
        o.user.username,
        `${o.user.firstName} ${o.user.lastName}`.trim(),
        maskEmail(o.user.email),
        li.productItem.product.name,
        li.productItem.deliveryMethod,
        li.quantity,
        Number(li.pricePerUnit).toFixed(2),
        subtotal.toFixed(2),
      ];
      rows.push(cells.map(escapeCsv).join(","));
    }
  }

  return rows.join("\n");
}

// mask buyer email so sellers can't harvest addresses.
// "john.doe@gmail.com" → "j***@gmail.com"
// Domain stays visible (avoids guessing) — only local part is masked.
function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@***";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const masked = local.length <= 2 ? "*".repeat(local.length) : local[0] + "***";
  return `${masked}@${domain}`;
}

function escapeCsv(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // neutralise spreadsheet formula injection. A buyer with
  // a username like `=cmd|'/c calc'!A0` would execute when the seller
  // opens this CSV in Excel/Sheets. Prefix with single quote so the
  // cell renders as text instead of evaluating.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * admin-driven version of becomeSeller. Used when an
 * operator promotes a buyer to seller from /admin/users.
 * Behaviour differs from the user-facing `becomeSeller`:
 *   - Picks defaults for `name`, `description`, `businessTypeId` so
 *     the admin doesn't have to fill the form upfront.
 *   - **Restores** a soft-deleted store instead of refusing — the
 *     "Make seller" action is idempotent so re-promoting after a
 *     "Make buyer" demotion doesn't create an orphan store row.
 *   - Doesn't audit on its own; the caller (admin.service.updateUserRole)
 *     writes its own `store.create` / `store.restore` audit row so
 *     the meta carries the originating admin's id.
 */
export async function adminCreateStore(userId: number, username: string) {
  const existing = await prisma.store.findUnique({
    where: { ownerId: userId },
    select: { storeId: true, deletedAt: true },
  });

  if (existing && !existing.deletedAt) {
    return { storeId: existing.storeId, action: "noop" as const };
  }

  if (existing && existing.deletedAt) {
    // Restore the soft-deleted store — same row, same id, same products.
    await prisma.store.update({
      where: { storeId: existing.storeId },
      data: { deletedAt: null },
    });
    return { storeId: existing.storeId, action: "restored" as const };
  }

  // Brand new store — pick defaults.
  const firstBusinessType = await prisma.businessType.findFirst({
    orderBy: { typeId: "asc" },
    select: { typeId: true },
  });
  if (!firstBusinessType) {
    throw new AppError(500, "NoBusinessTypes",
      "Can't auto-create a store: no BusinessType rows exist.");
  }

  const store = await prisma.$transaction(async (tx) => {
    const created = await tx.store.create({
      data: {
        ownerId: userId,
        businessTypeId: firstBusinessType.typeId,
        name: `@${username}'s store`.slice(0, 60),
        description:
          "Newly created store. Update name, description, and images on the storefront edit page.",
      },
      select: { storeId: true },
    });
    const existingStats = await tx.userStats.findUnique({ where: { userId } });
    const nextRole = existingStats?.role === "admin" ? "admin" : "seller";
    await tx.userStats.upsert({
      where: { userId },
      update: { role: nextRole },
      create: { userId, role: nextRole },
    });
    return created;
  });
  return { storeId: store.storeId, action: "created" as const };
}

/**
 * Create the user's first store + promote buyer to seller in one tx.
 * Admin owners stay admin. 409 StoreExists if they already own one.
 */
export async function becomeSeller(userId: number, input: BecomeSellerInput) {
  const existing = await prisma.store.findUnique({ where: { ownerId: userId } });
  if (existing) {
    throw new AppError(409, "StoreExists", `storeId=${existing.storeId}`);
  }

  return prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        ownerId: userId,
        businessTypeId: input.businessTypeId,
        name: input.name,
        description: input.description,
        profileImage: input.profileImage,
        coverImage: input.coverImage,
      },
    });
    const existingStats = await tx.userStats.findUnique({ where: { userId } });
    const nextRole = existingStats?.role === "admin" ? "admin" : "seller";
    await tx.userStats.upsert({
      where: { userId },
      update: { role: nextRole },
      create: { userId, role: nextRole },
    });
    return store;
  });
}

/**
 * PATCH /seller/store — partial update of the seller's own store.
 * Body keys not present are not touched (Prisma treats `undefined`
 * as no-op). The controller passes only the keys the user sent so
 * blanking an image (sending null) actually clears it.
 */
export async function updateStore(storeId: number, input: UpdateStoreInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.businessTypeId !== undefined) data.businessTypeId = input.businessTypeId;
  if (input.profileImage !== undefined) data.profileImage = input.profileImage;
  if (input.coverImage !== undefined) data.coverImage = input.coverImage;

  if (Object.keys(data).length === 0) return { noop: true as const };

  const updated = await prisma.store.update({
    where: { storeId },
    data,
    include: { businessType: true },
  });
  return { noop: false as const, store: updated };
}

/** POST /seller/products — create a product (with variants, images, tags). */
export async function createProduct(storeId: number, input: ProductInput) {
  // Product now carries its own deliveryMethod (per the
  // docx report). We mirror the first variant's method onto Product;
  // the seller form lists all variants with the same method today, so
  // the two stay in sync. The variant-level column is kept for now
  // until every consumer migrates to read from Product.
  const productDeliveryMethod = input.items[0]!.deliveryMethod;
  // isStackable defaults from delivery method when the
  // seller doesn't pass an explicit override:
  //   license_key → true (resellable, can buy multiple keys)
  //   everything else (download/streaming/email) → false (single copy)
  const isStackable = input.isStackable ?? (productDeliveryMethod === "license_key");
  return prisma.product.create({
    data: {
      storeId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      deliveryMethod: productDeliveryMethod,
      isStackable,
      items: {
        create: input.items.map((it, idx) => ({
          // ProductItem.name is required (the report models
          // each variant as a sellable line with its own name). Until
          // the seller form exposes per-variant naming, default to
          // "<product> — Variant N" so the column always has a value.
          name:
            input.items.length > 1
              ? `${input.name} — Variant ${idx + 1}`.slice(0, 100)
              : input.name.slice(0, 100),
          deliveryMethod: it.deliveryMethod,
          quantity: it.quantity,
          price: new Prisma.Decimal(it.price),
          discountPercent: it.discountPercent,
          discountAmount: new Prisma.Decimal(it.discountAmount),
          sampleUrl: it.sampleUrl,
          // Only persist deliveryUrl/licenseKeyTemplate when the
          // delivery method actually uses them — the controller still
          // accepts the fields but we strip them to avoid leaking a
          // download link that nobody will ever consume.
          deliveryUrl:
            it.deliveryMethod === "download" || it.deliveryMethod === "streaming"
              ? it.deliveryUrl ?? null
              : null,
          licenseKeyTemplate:
            it.deliveryMethod === "license_key" || it.deliveryMethod === "email"
              ? it.licenseKeyTemplate ?? null
              : null,
        })),
      },
      images: {
        create: input.images.map((url, i) => ({
          productImage: url,
          sortOrder: i,
        })),
      },
      productNTags: {
        create: input.tagIds.map((tagId) => ({ tagId })),
      },
    },
  });
}

/**
 * PATCH /seller/products/:id — fast-path for the pause toggle
 * ({ isActive: boolean } only) AND the full edit replacing
 * name/description/category + images + variants + tags.
 * Variants are tricky — OrderItem + CartItem FK into ProductItem,
 * so we don't blindly delete. Existing variants get UPDATEd in
 * order; extra incoming variants get CREATEd. Removing variants
 * is intentionally not supported (matches the legacy BFF route).
 */
export async function updateProduct(
  productId: number,
  storeId: number,
  body: { isActive?: boolean } | ProductInput,
) {
  // Pause-toggle fast path: { isActive: boolean } and ONE key only.
  if (
    typeof (body as any).isActive === "boolean" &&
    Object.keys(body).length === 1
  ) {
    await prisma.product.update({
      where: { productId },
      data: { isActive: (body as { isActive: boolean }).isActive },
    });
    return { isActive: (body as { isActive: boolean }).isActive };
  }

  const input = body as ProductInput;
  await prisma.$transaction(async (tx) => {
    const productDeliveryMethod = input.items[0]!.deliveryMethod;
    // same default rule as createProduct so an edit form
    // that doesn't expose the checkbox still picks the right value.
    const isStackable =
      input.isStackable ?? (productDeliveryMethod === "license_key");
    await tx.product.update({
      where: { productId },
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        // keep Product.deliveryMethod in sync with the
        // first variant's method (see createProduct rationale).
        deliveryMethod: productDeliveryMethod,
        isStackable,
      },
    });
    await tx.productImage.deleteMany({ where: { productId } });
    await tx.productImage.createMany({
      data: input.images.map((url, i) => ({
        productId,
        productImage: url,
        sortOrder: i,
      })),
    });
    await tx.productNTag.deleteMany({ where: { productId } });
    if (input.tagIds.length) {
      await tx.productNTag.createMany({
        data: input.tagIds.map((tagId) => ({ productId, tagId })),
      });
    }
    const existing = await tx.productItem.findMany({
      where: { productId },
      orderBy: { productItemId: "asc" },
    });
    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      const target = existing[i];
      const usesDeliveryUrl =
        it.deliveryMethod === "download" || it.deliveryMethod === "streaming";
      const usesLicenseTemplate =
        it.deliveryMethod === "license_key" || it.deliveryMethod === "email";
      if (target) {
        await tx.productItem.update({
          where: { productItemId: target.productItemId },
          data: {
            deliveryMethod: it.deliveryMethod,
            quantity: it.quantity,
            price: new Prisma.Decimal(it.price),
            discountPercent: it.discountPercent,
            discountAmount: new Prisma.Decimal(it.discountAmount),
            sampleUrl: it.sampleUrl,
            deliveryUrl: usesDeliveryUrl ? it.deliveryUrl ?? null : null,
            licenseKeyTemplate: usesLicenseTemplate
              ? it.licenseKeyTemplate ?? null
              : null,
          },
        });
      } else {
        await tx.productItem.create({
          data: {
            productId,
            // ProductItem.name is required. Mirror the
            // create flow's naming convention.
            name:
              input.items.length > 1
                ? `${input.name} — Variant ${i + 1}`.slice(0, 100)
                : input.name.slice(0, 100),
            deliveryMethod: it.deliveryMethod,
            quantity: it.quantity,
            price: new Prisma.Decimal(it.price),
            discountPercent: it.discountPercent,
            discountAmount: new Prisma.Decimal(it.discountAmount),
            sampleUrl: it.sampleUrl,
            deliveryUrl: usesDeliveryUrl ? it.deliveryUrl ?? null : null,
            licenseKeyTemplate: usesLicenseTemplate
              ? it.licenseKeyTemplate ?? null
              : null,
          },
        });
      }
    }
  });
  return { ok: true as const };
}

/**
 * DELETE /seller/products/:id — soft-delete (sets deletedAt). Order
 * history + reviews + favourites stay valid; public queries filter
 * by `deletedAt: null` so the product disappears immediately.
 * Writes a `product.delete` AuditLog row with the pre-delete name
 * snapshot so the audit feed reads cleanly.
 */
export async function deleteProduct(
  productId: number,
  storeId: number,
  actorId: number,
  productName: string,
) {
  await prisma.product.update({
    where: { productId },
    data: { deletedAt: new Date() },
  });
  await audit({
    actorId,
    action: "product.delete",
    targetType: "product",
    targetId: productId,
    meta: { storeId, productName },
  });
}

/**
 * POST /seller/products/:id/duplicate — clone a product (variants +
 * images + tags) but skip reviews + sales history. The clone is
 * created PAUSED (isActive=false) so the seller can polish before
 * exposing.
 */
export async function duplicateProduct(sourceId: number, storeId: number) {
  const source = await prisma.product.findFirst({
    where: { productId: sourceId, deletedAt: null },
    include: {
      items: true,
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: true,
    },
  });
  if (!source) throw new AppError(404, "NotFound");
  if (source.storeId !== storeId) throw new AppError(403, "Forbidden");

  const newName = `Copy of ${source.name}`.slice(0, 100);

  return prisma.product.create({
    data: {
      storeId: source.storeId,
      categoryId: source.categoryId,
      name: newName,
      description: source.description,
      isActive: false,
      // copy the source product's deliveryMethod onto the
      // clone (Product now owns this field; see createProduct).
      deliveryMethod: source.deliveryMethod,
      isStackable: source.isStackable,
      items: {
        create: source.items.map((it) => ({
          // ProductItem.name is required; carry the source
          // variant's name forward (it might be the per-variant label
          // we set on create, or the bare product name).
          name: it.name,
          deliveryMethod: it.deliveryMethod,
          quantity: it.quantity,
          price: new Prisma.Decimal(it.price),
          discountPercent: it.discountPercent,
          discountAmount: new Prisma.Decimal(it.discountAmount),
        })),
      },
      images: {
        create: source.images.map((im) => ({
          productImage: im.productImage,
          sortOrder: im.sortOrder,
        })),
      },
      productNTags: {
        create: source.productNTags.map((nt) => ({ tagId: nt.tagId })),
      },
    },
  });
}

/**
 * PATCH /seller/product-items/:id — targeted variant patch. Used
 * by the bulk-edit page to nudge price / discount / stock without
 * resending the whole product payload.
 */
export async function patchVariant(
  productItemId: number,
  storeId: number,
  input: PatchVariantInput,
) {
  const item = await prisma.productItem.findUnique({
    where: { productItemId },
    include: { product: { select: { storeId: true } } },
  });
  if (!item) throw new AppError(404, "NotFound");
  if (item.product.storeId !== storeId) throw new AppError(403, "Forbidden");

  const data: Record<string, unknown> = {};
  if (input.price !== undefined) {
    data.price = new Prisma.Decimal(input.price);
  }
  if (input.discountPercent !== undefined) data.discountPercent = input.discountPercent;
  if (input.quantity !== undefined) data.quantity = input.quantity;

  const updated = await prisma.productItem.update({
    where: { productItemId },
    data,
  });
  return { ...updated, price: Number(updated.price) };
}

/** GET /seller/coupons — list seller's coupons (with usage count). */
export async function listCoupons(storeId: number) {
  return prisma.coupon.findMany({
    where: { storeId },
    orderBy: { couponId: "desc" },
    include: { _count: { select: { usages: true } } },
  });
}

/** POST /seller/coupons — create a coupon for the seller's store. */
export async function createCoupon(storeId: number, input: CouponInput) {
  return prisma.coupon.create({
    data: {
      storeId,
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      usageLimit: input.usageLimit,
      isActive: input.isActive,
    },
  });
}

/**
 * PATCH /seller/orders/:id — flip an order to fulfilled OR cancelled.
 * Guardrails (mirror the legacy BFF route):
 *   • Order must contain at least one line from the seller's store
 *   • Refunded orders can never be re-flipped (409 AlreadyRefunded)
 *   • fulfilled requires status='paid' (409 InvalidTransition otherwise)
 */
export async function updateOrderStatus(
  orderId: number,
  storeId: number,
  actorId: number,
  input: UpdateOrderStatusInput,
) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      items: {
        include: {
          productItem: { select: { product: { select: { storeId: true } } } },
        },
      },
    },
  });
  if (!order) throw new AppError(404, "NotFound");

  const hasOwnedItem = order.items.some(
    (it) => it.productItem.product.storeId === storeId,
  );
  if (!hasOwnedItem) throw new AppError(403, "Forbidden");

  if (order.status === "refunded") {
    throw new AppError(409, "AlreadyRefunded");
  }
  if (input.status === "fulfilled" && order.status !== "paid") {
    throw new AppError(
      409,
      "InvalidTransition",
      "Only paid orders can be fulfilled.",
    );
  }

  await prisma.order.update({
    where: { orderId },
    data: { status: input.status },
  });
  await audit({
    actorId,
    action: input.status === "fulfilled" ? "order.fulfilled" : "order.cancelled",
    targetType: "order",
    targetId: orderId,
    meta: { from: order.status, to: input.status, storeId },
  });
}

/**
 * POST /seller/orders/:id/refund — mark refunded + create a `refund`
 * Transaction in one atomic write.
 * Sellers can only refund (a) orders containing one of their lines
 * AND (b) currently paid or fulfilled. Pending orders have no money
 * yet; cancelled / already-refunded shouldn't double-refund.
 */
export async function refundOrder(
  orderId: number,
  storeId: number,
  actorId: number,
) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      items: {
        include: {
          productItem: { select: { product: { select: { storeId: true } } } },
        },
      },
    },
  });
  if (!order) throw new AppError(404, "NotFound");

  const hasOwnedItem = order.items.some(
    (it) => it.productItem.product.storeId === storeId,
  );
  if (!hasOwnedItem) throw new AppError(403, "Forbidden");

  if (!["paid", "fulfilled"].includes(order.status)) {
    throw new AppError(
      409,
      "InvalidTransition",
      `Can't refund an order that's ${order.status}.`,
    );
  }

  // actually call Stripe so the buyer's card is refunded.
  // Without this the seller-facing UI says "refunded" but the money
  // never leaves the seller's connected account → silent fraud.
  let stripeRefundId: string | null = null;
  if (order.stripePaymentIntentId) {
    const store = await prisma.store.findUnique({
      where: { storeId },
      select: { stripeAccountId: true },
    });
    if (store?.stripeAccountId) {
      try {
        const refund = await stripeRefund(
          order.stripePaymentIntentId,
          store.stripeAccountId,
        );
        stripeRefundId = refund.id;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[seller.refundOrder] Stripe refund failed:", err);
        throw new AppError(
          502,
          "StripeRefundFailed",
          "Stripe declined the refund. The order has not been changed — try again later or contact support.",
        );
      }
    }
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { orderId },
      data: {
        status: "refunded",
        ...(stripeRefundId ? { stripeRefundId } : {}),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: order.userId,
        transactionType: "payout",
        totalAmount: new Prisma.Decimal(order.totalPrice).neg(),
      },
    }),
  ]);
  await audit({
    actorId,
    action: "order.refund",
    targetType: "order",
    targetId: orderId,
    meta: {
      buyerId: order.userId,
      amount: Number(order.totalPrice),
      storeId,
      from: order.status,
      stripeRefundId,
    },
  });
}

/**
 * Helper for product-related write controllers — confirm the product
 * exists and belongs to the seller's store. 404 vs 403 distinct so
 * dashboard UI can tell stale links from bug attempts.
 */
export async function assertProductOwnership(
  productId: number,
  storeId: number,
) {
  const product = await prisma.product.findUnique({ where: { productId } });
  if (!product) throw new AppError(404, "NotFound");
  if (product.storeId !== storeId) throw new AppError(403, "Forbidden");
  return product;
}

