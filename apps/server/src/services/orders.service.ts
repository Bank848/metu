import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { isConfigured as stripeConfigured, createPaymentIntent } from "./stripe.service.js";
import { getSettings } from "./settings.service.js";
import { sendEmail } from "../utils/email.js";
import type {
  CheckoutInput,
  CheckoutResponse,
  OrderDetail,
  OrderListItem,
} from "../models/orders.model.js";

/**
 * Checkout — the headline business-logic endpoint.
 *
 * Flow (single Prisma transaction so we never end up with a half-
 * created order):
 *   1. Resolve the user's active cart + lines + product + store joins.
 *   2. Optionally split into "selected" + "unselected" lines (partial
 *      checkout — unselected items get re-parented to the user's NEW
 *      active cart at the end).
 *   3. Resolve coupon (if any) — gated on isActive + date window.
 *   4. Compute per-line unit price (Decimal arithmetic; floats lose
 *      cents on percent discounts), subtotal, coupon-eligible
 *      subtotal (only lines from the coupon's store count), then
 *      apply discount (cap at the eligible subtotal).
 *   5. Create transaction + order + order_items rows in one
 *      transaction. Stamp couponId only on lines from the coupon's
 *      store so the receipt can show which lines were discounted.
 *   6. Flip the spent cart to "checked_out" + create a fresh active
 *      cart. Re-parent unselected items into it.
 *   7. Record CouponUsage (one per checkout, not per line).
 *
 * Returns the same envelope as the legacy BFF route so the UI doesn't
 * need re-shaping (orderId + transactionId + numbers).
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

  // Coupon resolution — only the active row + within the date window.
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

  // Decimal math throughout — JS float arithmetic on percent
  // discounts loses cents that the receipt would surface
  // ("฿123.456" instead of "฿123.46").
  const unitPrice = (ci: (typeof selectedItems)[number]) =>
    new Prisma.Decimal(ci.productItem.price).mul(
      new Prisma.Decimal(100 - (ci.productItem.discountPercent ?? 0)).div(100),
    );

  let subtotal = new Prisma.Decimal(0);
  let couponEligibleSubtotal = new Prisma.Decimal(0);
  // Phase 38C — a master coupon (storeId === null) is platform-wide and
  // discounts every line in the cart. Per-store coupons keep the old
  // behaviour: only lines belonging to the coupon's store count.
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
      // Discount can't exceed the eligible subtotal (e.g. ฿1000 off
      // a single ฿200 item is capped at ฿200).
      couponDiscount = couponEligibleSubtotal;
    }
  }
  const total = subtotal.sub(couponDiscount);

  // Phase 27 — single-store, Stripe-configured carts get a real
  // PaymentIntent ; otherwise the order lands in demo mode (`paid`
  // status, no Stripe charge). Multi-store carts always use demo
  // mode for now — Stripe Connect doesn't natively support N-way
  // splits in one charge.
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
        totalPrice: total,
        // Stripe path: order starts `pending` and a webhook flips it
        // to `paid` after the buyer confirms. Demo path: straight to
        // `paid` so the rest of the app works without Stripe wired up.
        status: useStripe ? "pending" : "paid",
        transactionId: txn.transactionId,
        giftRecipientEmail: input.giftRecipientEmail || null,
        giftMessage: input.giftMessage || null,
        items: {
          create: selectedItems.map((ci) => ({
            productItemId: ci.productItemId,
            quantity: ci.quantity,
            priceAtPurchase: unitPrice(ci),
            // Phase 38C — master coupon (storeId === null) stamps every
            // line ; per-store coupon stamps only its own lines so the
            // receipt shows which lines were actually discounted.
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

  // Stripe-side work happens AFTER the DB transaction so a Stripe
  // outage can't roll back a successful order create. If the intent
  // call fails the order is still recorded (in `pending`) and a
  // future retry path can re-issue the PaymentIntent.
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
      // Don't surface the Stripe error to the buyer — log + move on.
      // Order remains `pending` ; admin can investigate via dashboard.
      // eslint-disable-next-line no-console
      console.error("[orders.checkout] Stripe createPaymentIntent failed:", err);
    }
  }

  // Phase 33 — demo orders (no Stripe path) jump straight to fulfilled
  // because the order is already `paid` in the DB ; otherwise the
  // buyer would never see their license keys / download links. Stripe
  // orders go through finalizeOrder() via the webhook handler later.
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

// ─────────────────────────────────────────────────────────────────
// Phase 33 — order delivery
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a license key from an optional template. The template uses
 * `XXXX` as a placeholder for a 4-char random alphanumeric block (we
 * use a 31-char alphabet with the visually-confusing 0/O/1/I/L stripped
 * so customers don't mistype them). Null template falls back to a
 * UUID v4.
 *
 * Examples:
 *   template="METU-XXXX-XXXX-XXXX" → "METU-A3F2-9B11-CDEF"
 *   template=null                  → "f47ac10b-58cc-4372-a567-0e02b2c3d479"
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
 * Finalise an order after Stripe confirms payment. Generates per-item
 * delivery payloads (license keys for `license_key` / `email` methods,
 * snapshots `delivery_url` for `download` / `streaming`), flips the
 * order to `fulfilled`, then fires the receipt email.
 *
 * Idempotent: short-circuits when every item already has `deliveredAt`
 * set, so webhook retries are safe to no-op.
 *
 * Demo orders (no Stripe charge) also pass through this function — the
 * checkout path calls finalizeOrder() directly when the order skips
 * Stripe, so demo buyers see the same delivery UI as real buyers.
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

  // Fire-and-forget email; receipt failures must NOT roll back the
  // delivery — the buyer can always re-download from /orders/[id].
  sendOrderReceipt(orderId).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[order] receipt email failed:", err);
  });
}

/**
 * Render + send the buyer's receipt email. Items are grouped by store
 * so the email reads "here's what you got from Store A / Store B / ..."
 * with each store's contact info inline. Triggered by finalizeOrder()
 * after fulfilment ; never called from the checkout path directly.
 */
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

  // Minimal inline-styled HTML mirror — kept simple for email-client
  // compat (no <style> blocks, no external CSS).
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const htmlParts: string[] = [
    `<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">`,
    `<h2 style="color:#0f172a; margin: 0 0 12px;">Order #${orderId} delivered</h2>`,
    `<p style="margin: 0 0 16px;">Hi ${escape(buyer.firstName)}, your payment cleared and the items below are ready.</p>`,
  ];
  for (const { store, lines } of stores) {
    htmlParts.push(
      `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-bottom:14px;">`,
      `<div style="background:#10b981; color:white; font-weight:600; padding:6px 10px; border-radius:4px; display:inline-block; margin-bottom:10px;">${escape(store.name)}</div>`,
    );
    for (const it of lines) {
      const name = escape(it.productItem.product.name);
      htmlParts.push(
        `<div style="margin: 8px 0; padding: 8px; background:#f8fafc; border-radius:4px;">`,
        `<div style="font-weight:600;">${it.quantity}× ${name}</div>`,
      );
      if (it.deliveredKey) {
        htmlParts.push(
          `<div style="font-family:ui-monospace,monospace; background:#0f172a; color:#a7f3d0; padding:6px 10px; border-radius:4px; margin-top:6px; word-break:break-all;">${escape(it.deliveredKey)}</div>`,
        );
      }
      if (it.deliveredUrl) {
        htmlParts.push(
          `<a href="${escape(it.deliveredUrl)}" style="display:inline-block; margin-top:6px; background:#10b981; color:white; padding:8px 14px; border-radius:6px; text-decoration:none; font-weight:600;">Download</a>`,
        );
      }
      htmlParts.push(`</div>`);
    }
    const contact: string[] = [];
    if (store.contactEmail) contact.push(`email ${escape(store.contactEmail)}`);
    if (store.phone) contact.push(`phone ${escape(store.phone)}`);
    if (contact.length) {
      htmlParts.push(
        `<div style="font-size:12px; color:#64748b; margin-top:8px;">Contact ${escape(store.name)}: ${contact.join(" · ")}</div>`,
      );
    }
    htmlParts.push(`</div>`);
  }
  htmlParts.push(
    `<p style="font-size:13px; color:#64748b; margin-top:20px;">View this order: <a href="https://metu.fly.dev/orders/${orderId}" style="color:#10b981;">metu.fly.dev/orders/${orderId}</a></p>`,
    `<p style="font-size:11px; color:#94a3b8; margin-top:24px;">— METU Marketplace</p>`,
    `</div>`,
  );

  await sendEmail({
    to: buyer.email,
    subject,
    html: htmlParts.join("\n"),
    text: textLines.join("\n"),
  });
}

/**
 * List — every order belonging to the user (newest first), with the
 * minimum joins the receipts page renders. Same shape as the legacy
 * BFF /api/orders so the UI stays unchanged.
 */
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

/**
 * Detail — single order, gated on ownership (the cart.userId join is
 * the gate; another user's orderId returns null → 404).
 */
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
