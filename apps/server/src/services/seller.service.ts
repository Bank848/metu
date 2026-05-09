import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { Request } from "express";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import { bangkokStartOfDay, bangkokEndOfDay } from "../utils/time.js";
import { refundOrder as stripeRefund } from "./stripe.service.js";

// Narrow type so services don't have to drag in the full Express.Request.
type AuditReq = Pick<Request, "ip" | "headers"> | null | undefined;
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
 * List the seller's products. Hard-delete removes them from this list
 * automatically — there is no soft-delete column anymore.
 */
export async function listProducts(storeId: number) {
  return prisma.product.findMany({
    where: { storeId },
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
 * Single product scoped to the seller's store. 404 when missing,
 * 403 when it belongs to another store.
 */
export async function getProduct(productId: number, storeId: number) {
  const product = await prisma.product.findUnique({
    where: { productId },
    include: {
      category: true,
      items: { orderBy: { productItemId: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      details: { orderBy: { productDetailId: "asc" } },
    },
  });
  if (!product) throw new AppError(404, "NotFound");
  if (product.storeId !== storeId) throw new AppError(403, "Forbidden");
  return product;
}

/**
 * Analytics dashboard payload. Mixed parallel + serial queries to
 * stay friendly to Neon's free-tier connection budget.
 */
export async function getStats(storeId: number): Promise<SellerStatsResponse> {
  const [store, productCount, recentReviews, totals] = await Promise.all([
    prisma.store.findUnique({
      where: { storeId },
      include: { businessType: true },
    }),
    prisma.product.count({ where: { storeId } }),
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
      AND o.status IN ('paid','fulfilled')
    GROUP BY day
    ORDER BY day
  `;

  // Mirror the KPI status filter so revenue/units match the headline
  // numbers. FILTER (WHERE o.order_id IS NOT NULL) drops non-settled lines.
  const topProducts = await prisma.$queryRaw<
    Array<{ product_id: number; name: string; revenue: string; units: bigint }>
  >`
    SELECT p.product_id, p.name,
           COALESCE(SUM(oi.price_per_unit * oi.quantity) FILTER (WHERE o.order_id IS NOT NULL), 0)::text AS revenue,
           COALESCE(SUM(oi.quantity) FILTER (WHERE o.order_id IS NOT NULL), 0)::bigint AS units
    FROM product p
    LEFT JOIN product_item pi ON pi.product_id = p.product_id
    LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
    LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
    WHERE p.store_id = ${storeId}
    GROUP BY p.product_id, p.name
    HAVING COALESCE(SUM(oi.quantity) FILTER (WHERE o.order_id IS NOT NULL), 0) > 0
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
 * Orders containing at least one line from this store. Sub-includes
 * are scoped to the seller's lines so multi-store orders don't leak
 * competitors' details.
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
      // Skip non-our and orphaned lines.
      if (!li.productItem) continue;
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
  // Neutralise spreadsheet formula injection by prefixing risky
  // leading chars with a single quote.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Admin-driven becomeSeller. Picks default name/description/business
 * type, idempotent on re-promote. Caller writes the audit row.
 */
export async function adminCreateStore(userId: number, username: string) {
  const existing = await prisma.store.findUnique({
    where: { ownerId: userId },
    select: { storeId: true },
  });

  if (existing) {
    return { storeId: existing.storeId, action: "noop" as const };
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
 * PATCH /seller/store — partial update; only the keys present in
 * `input` are touched.
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
  // Mirror the first variant's deliveryMethod onto Product (seller
  // form keeps every variant on the same method).
  const productDeliveryMethod = input.items[0]!.deliveryMethod;
  // isStackable defaults: license_key → true, others → false.
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
          // ProductItem.name is required; default to "<product> — Variant N".
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
          // Persist deliveryUrl / licenseKeyTemplate only when the
          // method uses them.
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
      // Additional info rows (per Product details).
      details: {
        create: (input.details ?? []).map((d) => ({
          detailName: d.detailName,
          detailValue: d.detailValue,
        })),
      },
    },
  });
}

/**
 * PATCH /seller/products/:id — fast-path pause toggle, otherwise
 * full edit. Variants are upserted by index (existing UPDATE, extras
 * CREATE); removal isn't supported because OrderItem/CartItem FK in.
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
    // Same isStackable default rule as createProduct.
    const isStackable =
      input.isStackable ?? (productDeliveryMethod === "license_key");
    await tx.product.update({
      where: { productId },
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
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
    // Replace-all is safe for ProductDetail (not an FK target).
    await tx.productDetail.deleteMany({ where: { productId } });
    if ((input.details ?? []).length > 0) {
      await tx.productDetail.createMany({
        data: input.details.map((d) => ({
          productId,
          detailName: d.detailName,
          detailValue: d.detailValue,
        })),
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
            // Required ProductItem.name; mirror createProduct convention.
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
 * DELETE /seller/products/:id — hard-delete; OrderItem snapshot
 * fields keep historical receipts valid. Writes a `product.delete` audit row.
 */
export async function deleteProduct(
  productId: number,
  storeId: number,
  actorId: number,
  productName: string,
) {
  await prisma.product.delete({
    where: { productId },
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
 * POST /seller/products/:id/duplicate — clone variants/images/tags
 * (no reviews/history). Clone starts paused.
 */
export async function duplicateProduct(sourceId: number, storeId: number) {
  const source = await prisma.product.findFirst({
    where: { productId: sourceId },
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
      deliveryMethod: source.deliveryMethod,
      isStackable: source.isStackable,
      items: {
        create: source.items.map((it) => ({
          // Carry the source variant's name forward.
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
      startDate: bangkokStartOfDay(input.startDate),
      endDate: bangkokEndOfDay(input.endDate),
      usageLimit: input.usageLimit,
      isActive: input.isActive,
    },
  });
}

/**
 * PATCH /seller/orders/:id — flip to fulfilled or cancelled.
 * Order must own at least one line from the seller's store; refunded
 * orders can't be re-flipped; fulfilled requires status='paid'.
 */
export async function updateOrderStatus(
  orderId: number,
  storeId: number,
  actorId: number,
  input: UpdateOrderStatusInput,
  req?: AuditReq,
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
    (it) => it.productItem?.product.storeId === storeId,
  );
  if (!hasOwnedItem) {
    await audit({
      actorId,
      action: "seller.order.write.denied",
      targetType: "order",
      targetId: orderId,
      meta: { reason: "Forbidden", storeId, requested: input.status },
      req,
    });
    throw new AppError(403, "Forbidden");
  }
  // Multi-store IDOR guard: order.status is shared across all lines,
  // so cross-store mutation would flip another seller's items too.
  const otherStoreLines = order.items.filter(
    (it) => it.productItem?.product.storeId !== storeId,
  );
  if (otherStoreLines.length > 0) {
    await audit({
      actorId,
      action: "seller.order.status.denied_cross_store",
      targetType: "order",
      targetId: orderId,
      meta: { storeId, requested: input.status },
      req,
    });
    throw new AppError(
      409,
      "MultiStoreOrder",
      "This order spans multiple stores. Ask an admin to update the status.",
    );
  }

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
  // Block paid→cancelled; force sellers through the refund path so
  // the money trail is consistent. pending→cancelled stays allowed.
  if (input.status === "cancelled" && order.status === "paid") {
    await audit({
      actorId,
      action: "seller.order.update.denied",
      targetType: "order",
      targetId: orderId,
      meta: { storeId, reason: "paid_must_refund_first" },
      req,
    });
    throw new AppError(
      409,
      "RefundFirst",
      "This order is already paid. Refund it instead of cancelling so the buyer gets their money back.",
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
    req,
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
    (it) => it.productItem?.product.storeId === storeId,
  );
  if (!hasOwnedItem) {
    await audit({
      actorId,
      action: "seller.order.refund.denied",
      targetType: "order",
      targetId: orderId,
      meta: { reason: "Forbidden", storeId },
    });
    throw new AppError(403, "Forbidden");
  }

  // Multi-store guard: order.status is shared, so a partial refund
  // across stores can't be represented. Refuse instead of corrupting.
  const otherStoreLines = order.items.filter(
    (it) => it.productItem?.product.storeId !== storeId,
  );
  if (otherStoreLines.length > 0) {
    await audit({
      actorId,
      action: "seller.order.refund.denied_cross_store",
      targetType: "order",
      targetId: orderId,
      meta: { storeId },
    });
    throw new AppError(
      409,
      "MultiStoreOrder",
      "This order spans multiple stores. Ask an admin to refund the buyer.",
    );
  }

  if (!["paid", "fulfilled"].includes(order.status)) {
    throw new AppError(
      409,
      "InvalidTransition",
      `Can't refund an order that's ${order.status}.`,
    );
  }

  // Issue the Stripe refund so the buyer's card is actually credited.
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

  // Restore non-digital stock on refund (kept in sync with the same
  // DIGITAL_METHODS set used by webhook + sweepExpiredOrders).
  const DIGITAL_METHODS = new Set(["download", "email", "license_key", "streaming"]);
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.productItemId == null) continue;
      const pIt = await tx.productItem.findUnique({
        where: { productItemId: item.productItemId },
        select: { deliveryMethod: true },
      });
      if (!pIt || DIGITAL_METHODS.has(pIt.deliveryMethod)) continue;
      await tx.productItem.update({
        where: { productItemId: item.productItemId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    await tx.order.update({
      where: { orderId },
      data: {
        status: "refunded",
        ...(stripeRefundId ? { stripeRefundId } : {}),
      },
    });
    await tx.transaction.create({
      data: {
        userId: order.userId,
        transactionType: "payout",
        totalAmount: new Prisma.Decimal(order.totalPrice).neg(),
      },
    });
  });
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

/** Confirm a product belongs to the seller's store; 404 vs 403 distinct. */
export async function assertProductOwnership(
  productId: number,
  storeId: number,
) {
  const product = await prisma.product.findUnique({ where: { productId } });
  if (!product) throw new AppError(404, "NotFound");
  if (product.storeId !== storeId) throw new AppError(403, "Forbidden");
  return product;
}

