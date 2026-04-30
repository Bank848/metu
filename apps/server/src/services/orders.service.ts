import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { isConfigured as stripeConfigured, createPaymentIntent } from "./stripe.service.js";
import { getSettings } from "./settings.service.js";
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
  for (const ci of selectedItems) {
    const line = unitPrice(ci).mul(ci.quantity);
    subtotal = subtotal.add(line);
    if (resolvedCoupon && ci.productItem.product.storeId === resolvedCoupon.storeId) {
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
            // Stamp couponId only on lines from the coupon's store.
            couponId:
              resolvedCoupon &&
              ci.productItem.product.storeId === resolvedCoupon.storeId
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
