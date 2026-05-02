import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { isConfigured as stripeConfigured, createPaymentIntent } from "./stripe.service.js";
import { getSettings } from "./settings.service.js";
import { sendEmail } from "../utils/email.js";
import { renderEmailLayout } from "../utils/email-template.js";
import type {
  CheckoutInput,
  CheckoutResponse,
  OrderDetail,
  OrderListItem,
} from "../models/orders.model.js";

/**
 * Checkout. Wraps cart resolution, coupon, line totals, order create,
 * stock decrement, and cart swap in a single Prisma transaction.
 */
export async function checkout(
  userId: number,
  input: CheckoutInput,
): Promise<CheckoutResponse> {
  const cart = await prisma.cart.findFirst({
    where: { userId, status: "active" },
    include: {
      items: { include: { productItem: { include: { product: true } } } },
    },
  });
  if (!cart || cart.items.length === 0) {
    throw new AppError(400, "EmptyCart");
  }

  const selectedSet =
    input.selectedCartItemIds && input.selectedCartItemIds.length > 0
      ? new Set(input.selectedCartItemIds)
      : null;
  const selectedItems = selectedSet
    ? cart.items.filter((ci) => selectedSet.has(ci.cartItemId))
    : cart.items;
  const unselectedItems = selectedSet
    ? cart.items.filter((ci) => !selectedSet.has(ci.cartItemId))
    : [];
  if (selectedItems.length === 0) {
    throw new AppError(400, "EmptyCart", "No items selected for checkout.");
  }

  // Phase 48 — second line of the already-owned guard. cart.service
  // already blocks the add, but a buyer who pre-loaded their cart
  // before we shipped the guard could still slip through. Reject
  // checkout if any selected line is a non-stackable product the
  // buyer already owns.
  const nonStackableProductIds = selectedItems
    .filter((ci) => !ci.productItem.product.isStackable)
    .map((ci) => ci.productItem.product.productId);
  if (nonStackableProductIds.length > 0) {
    const ownedAlready = await prisma.order.findFirst({
      where: {
        userId,
        status: { in: ["paid", "fulfilled", "pending"] },
        items: {
          some: {
            productItem: { productId: { in: nonStackableProductIds } },
          },
        },
      },
      select: {
        orderId: true,
        items: {
          where: {
            productItem: { productId: { in: nonStackableProductIds } },
          },
          select: { productItem: { select: { productId: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (ownedAlready) {
      const ownedProductId = ownedAlready.items[0]?.productItem.productId;
      throw new AppError(
        409,
        "AlreadyOwned",
        `Your cart contains a product you already own — view order #${ownedAlready.orderId}.`,
        { orderId: ownedAlready.orderId, productId: ownedProductId },
      );
    }
  }

  // Active row inside the date window.
  let resolvedCoupon: Awaited<ReturnType<typeof prisma.coupon.findFirst>> | null = null;
  if (input.couponCode) {
    const now = new Date();
    resolvedCoupon = await prisma.coupon.findFirst({
      where: {
        code: input.couponCode,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
  }

  // Decimal math: float arithmetic on percent discounts loses cents.
  const unitPrice = (ci: (typeof selectedItems)[number]) =>
    new Prisma.Decimal(ci.productItem.price).mul(
      new Prisma.Decimal(100 - (ci.productItem.discountPercent ?? 0)).div(100),
    );

  let subtotal = new Prisma.Decimal(0);
  let couponEligibleSubtotal = new Prisma.Decimal(0);
  // Master coupon (storeId === null) is platform-wide; per-store
  // coupons only discount lines belonging to that store.
  const couponIsMaster = resolvedCoupon !== null && resolvedCoupon.storeId === null;
  for (const ci of selectedItems) {
    const line = unitPrice(ci).mul(ci.quantity);
    subtotal = subtotal.add(line);
    if (
      resolvedCoupon &&
      (couponIsMaster ||
        ci.productItem.product.storeId === resolvedCoupon.storeId)
    ) {
      couponEligibleSubtotal = couponEligibleSubtotal.add(line);
    }
  }

  let couponDiscount = new Prisma.Decimal(0);
  if (resolvedCoupon && couponEligibleSubtotal.gt(0)) {
    if (resolvedCoupon.discountType === "percent") {
      couponDiscount = couponEligibleSubtotal
        .mul(resolvedCoupon.discountValue)
        .div(100);
    } else {
      couponDiscount = new Prisma.Decimal(resolvedCoupon.discountValue);
    }
    if (couponDiscount.gt(couponEligibleSubtotal)) {
      // Cap discount at the eligible subtotal.
      couponDiscount = couponEligibleSubtotal;
    }
  }
  const total = subtotal.sub(couponDiscount);

  // Single-store + Stripe-configured carts get a real PaymentIntent;
  // multi-store carts fall back to demo mode (no Stripe charge).
  const storeIds = new Set(selectedItems.map((ci) => ci.productItem.product.storeId));
  const singleStoreId = storeIds.size === 1 ? selectedItems[0]!.productItem.product.storeId : null;
  let useStripe = false;
  let sellerStripeAccountId: string | null = null;
  if (stripeConfigured() && singleStoreId !== null) {
    const store = await prisma.store.findUnique({
      where: { storeId: singleStoreId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    });
    if (store?.stripeAccountId && store.stripeChargesEnabled) {
      useStripe = true;
      sellerStripeAccountId = store.stripeAccountId;
    }
  }

  const settings = await getSettings();

  const result = await prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: {
        transactionType: "purchase",
        userId,
        totalAmount: total,
      },
    });
    const order = await tx.order.create({
      data: {
        cartId: cart.cartId,
        // Phase 45 — Order.userId is now a direct FK (denormalised from
        // Cart.userId per the submitted report). Set it from the cart
        // owner so reports/analytics can join Order → User without the
        // cart hop.
        userId,
        totalPrice: total,
        // Stripe path starts `pending` (webhook flips to `paid`); demo path is paid.
        status: useStripe ? "pending" : "paid",
        transactionId: txn.transactionId,
        giftRecipientEmail: input.giftRecipientEmail || null,
        giftMessage: input.giftMessage || null,
        items: {
          create: selectedItems.map((ci) => ({
            productItemId: ci.productItemId,
            quantity: ci.quantity,
            pricePerUnit: unitPrice(ci),
            // Master coupon stamps every line; per-store stamps only its own lines.
            couponId:
              resolvedCoupon &&
              (couponIsMaster ||
                ci.productItem.product.storeId === resolvedCoupon.storeId)
                ? resolvedCoupon.couponId
                : null,
          })),
        },
      },
    });

    // Atomic stock decrement; digital delivery methods skip it.
    // Conditional UPDATE returns 0 rows on a concurrent depletion - we throw to roll back.
    const DIGITAL_METHODS = new Set(["download", "email", "license_key", "streaming"]);
    for (const ci of selectedItems) {
      if (DIGITAL_METHODS.has(ci.productItem.deliveryMethod)) continue;
      const updated = await tx.productItem.updateMany({
        where: {
          productItemId: ci.productItemId,
          quantity: { gte: ci.quantity },
        },
        data: { quantity: { decrement: ci.quantity } },
      });
      if (updated.count === 0) {
        throw new AppError(
          409,
          "OutOfStock",
          `Not enough stock for "${ci.productItem.product.name}". Adjust quantity and try again.`,
        );
      }
    }

    await tx.cart.update({
      where: { cartId: cart.cartId },
      data: { status: "checked_out" },
    });
    const newCart = await tx.cart.create({
      data: { userId, status: "active" },
    });
    if (unselectedItems.length > 0) {
      await tx.cartItem.updateMany({
        where: { cartItemId: { in: unselectedItems.map((ci) => ci.cartItemId) } },
        data: { cartId: newCart.cartId },
      });
    }
    if (resolvedCoupon) {
      await tx.couponUsage.create({
        data: { couponId: resolvedCoupon.couponId, userId },
      });
    }
    return { order, txn };
  });

  // Stripe call after the DB tx so an outage can't roll back the order.
  let stripeClientSecret: string | null = null;
  if (useStripe && sellerStripeAccountId) {
    try {
      const buyer = await prisma.user.findUnique({
        where: { userId },
        select: { email: true },
      });
      const intent = await createPaymentIntent({
        orderId: result.order.orderId,
        amountBaht: Number(total),
        sellerStripeAccountId,
        applicationFeePercent: Number(settings.platformFeePercent),
        buyerEmail: buyer?.email,
      });
      stripeClientSecret = intent.clientSecret;
      await prisma.order.update({
        where: { orderId: result.order.orderId },
        data: { stripePaymentIntentId: intent.paymentIntentId },
      });
    } catch (err) {
      // Order stays `pending`; admin can investigate via dashboard.
      // eslint-disable-next-line no-console
      console.error("[orders.checkout] Stripe createPaymentIntent failed:", err);
    }
  }

  // Demo orders skip Stripe and finalise immediately so keys are visible.
  if (!useStripe) {
    await finalizeOrder(result.order.orderId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[orders.checkout] demo finalize failed:", err);
    });
  }

  return {
    orderId: result.order.orderId,
    transactionId: result.txn.transactionId,
    total: Number(total),
    subtotal: Number(subtotal),
    discount: Number(couponDiscount),
    couponStoreId: resolvedCoupon ? resolvedCoupon.storeId : null,
    stripeClientSecret,
  };
}

/**
 * Generate a license key from a template. `XXXX` blocks are replaced
 * with random alphanumerics (no 0/O/1/I/L). Null template returns a UUID.
 */
function generateLicenseKey(template: string | null): string {
  if (!template) return crypto.randomUUID();
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return template.replace(/X{4}/g, () => {
    let block = "";
    for (let i = 0; i < 4; i++) {
      block += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return block;
  });
}

/**
 * Finalise an order: generate delivery payloads, flip to `fulfilled`,
 * fire the receipt email. Idempotent when items already have deliveredAt.
 */
export async function finalizeOrder(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { items: { include: { productItem: true } } },
  });
  if (!order) return;
  if (order.items.length === 0) return;
  if (order.items.every((i) => i.deliveredAt)) return;

  for (const item of order.items) {
    if (item.deliveredAt) continue;
    const pi = item.productItem;
    let key: string | null = null;
    let url: string | null = null;
    switch (pi.deliveryMethod) {
      case "license_key":
      case "email":
        key = generateLicenseKey(pi.licenseKeyTemplate);
        break;
      case "download":
      case "streaming":
        url = pi.deliveryUrl ?? null;
        break;
    }
    await prisma.orderItem.update({
      where: { orderItemId: item.orderItemId },
      data: { deliveredKey: key, deliveredUrl: url, deliveredAt: new Date() },
    });
  }

  await prisma.order.update({
    where: { orderId },
    data: { status: "fulfilled" },
  });

  // Fire-and-forget; receipt failures don't roll back delivery.
  sendOrderReceipt(orderId).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[order] receipt email failed:", err);
  });
}

// Render + send the buyer's receipt email, grouped by store.
export async function sendOrderReceipt(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      cart: { include: { user: { select: { email: true, firstName: true } } } },
      items: {
        include: {
          productItem: {
            include: {
              product: {
                include: {
                  store: {
                    select: {
                      storeId: true,
                      name: true,
                      contactEmail: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!order) return;
  const buyer = order.cart?.user;
  if (!buyer?.email) return;

  // Group items by store so the email reads as one section per store
  // (multi-store cart was a documented requirement even though the
  // current Stripe flow constrains to single-store at checkout time).
  type Store = NonNullable<typeof order.items[number]["productItem"]["product"]["store"]>;
  type Bucket = { store: Store; lines: typeof order.items };
  const byStore = new Map<number, Bucket>();
  for (const it of order.items) {
    const sid = it.productItem.product.store.storeId;
    const bucket = byStore.get(sid) ?? { store: it.productItem.product.store, lines: [] };
    bucket.lines.push(it);
    byStore.set(sid, bucket);
  }
  const stores = [...byStore.values()];

  const subject =
    stores.length === 1
      ? `Your METU order #${orderId} — items from ${stores[0].store.name}`
      : `Your METU order #${orderId} — items from ${stores.length} stores`;

  // Plain-text body
  const textLines: string[] = [
    `Hi ${buyer.firstName},`,
    "",
    "Thanks for your purchase. Your payment has cleared and the items below are ready.",
    "",
  ];
  for (const { store, lines } of stores) {
    textLines.push(`── ${store.name} ──`);
    for (const it of lines) {
      const name = it.productItem.product.name;
      textLines.push(`  ${it.quantity}× ${name}`);
      if (it.deliveredKey) textLines.push(`     License key: ${it.deliveredKey}`);
      if (it.deliveredUrl) textLines.push(`     Download: ${it.deliveredUrl}`);
    }
    const contact: string[] = [];
    if (store.contactEmail) contact.push(`email ${store.contactEmail}`);
    if (store.phone) contact.push(`phone ${store.phone}`);
    if (contact.length) textLines.push(`  Contact ${store.name}: ${contact.join(" · ")}`);
    textLines.push("");
  }
  textLines.push(
    `View on the site: https://metu.fly.dev/orders/${orderId}`,
    "",
    "— METU Marketplace",
  );

  // Compose the per-store body cards using the shared branded layout.
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const storeCards: string[] = [];
  for (const { store, lines } of stores) {
    storeCards.push(
      `<div style="margin: 20px 0 0; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; background: #fafbfc;">`,
      `<div style="display: inline-block; background: #10b981; color: #ffffff; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 14px;">${escape(store.name)}</div>`,
    );
    for (const it of lines) {
      const name = escape(it.productItem.product.name);
      storeCards.push(
        `<div style="margin: 10px 0; padding: 12px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;">`,
        `<div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">${it.quantity}&times; ${name}</div>`,
      );
      if (it.deliveredKey) {
        storeCards.push(
          `<div style="margin-top: 8px;">`,
          `<div style="font-size: 10px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">License key</div>`,
          `<div style="font-family: ui-monospace, 'SF Mono', Menlo, monospace; background: #0f172a; color: #6EE7B7; padding: 10px 12px; border-radius: 8px; word-break: break-all; font-size: 13px; letter-spacing: 0.02em;">${escape(it.deliveredKey)}</div>`,
          `</div>`,
        );
      }
      if (it.deliveredUrl) {
        storeCards.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;"><tr><td style="border-radius: 8px; background: #10b981;"><a href="${escape(it.deliveredUrl)}" style="display: inline-block; padding: 10px 18px; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none;">Download &rarr;</a></td></tr></table>`,
        );
      }
      storeCards.push(`</div>`);
    }
    const contact: string[] = [];
    if (store.contactEmail) contact.push(`<a href="mailto:${escape(store.contactEmail)}" style="color: #047857; text-decoration: none;">${escape(store.contactEmail)}</a>`);
    if (store.phone) contact.push(escape(store.phone));
    if (contact.length) {
      storeCards.push(
        `<div style="font-size: 12px; color: #64748b; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">Contact ${escape(store.name)}: ${contact.join(" &middot; ")}</div>`,
      );
    }
    storeCards.push(`</div>`);
  }

  const html = renderEmailLayout({
    heading: `Hi ${escape(buyer.firstName)} - your goods are ready`,
    intro: `Payment cleared. License keys + download links for order <strong>#${orderId}</strong> are below; everything stays available on your account too.`,
    cta: { label: "View order", url: `https://metu.fly.dev/orders/${orderId}` },
    bodyHtml: storeCards.join(""),
  });

  await sendEmail({
    to: buyer.email,
    subject,
    html,
    text: textLines.join("\n"),
  });
}

// List the user's orders newest first.
export async function listForUser(userId: number): Promise<OrderListItem[]> {
  return prisma.order.findMany({
    where: { cart: { userId } },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          productItem: {
            include: {
              product: {
                include: {
                  images: { take: 1, orderBy: { sortOrder: "asc" } },
                  store: { select: { name: true, storeId: true } },
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

// Single order; ownership gated via cart.userId.
export async function findByIdForUser(
  userId: number,
  orderId: number,
): Promise<OrderDetail | null> {
  return prisma.order.findFirst({
    where: { orderId, cart: { userId } },
    include: {
      items: {
        include: {
          productItem: {
            include: {
              product: {
                include: {
                  images: { take: 1, orderBy: { sortOrder: "asc" } },
                  store: { select: { name: true, storeId: true } },
                  productNTags: {
                    include: { tag: { select: { tagId: true, tagName: true } } },
                  },
                },
              },
            },
          },
          coupon: true,
        },
      },
      transaction: true,
    },
  });
}
