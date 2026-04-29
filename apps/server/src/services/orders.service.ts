import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { debitTx } from "./wallet.service.js";
import { getSettings } from "./settings.service.js";
import type {
  CheckoutInput,
  CheckoutResponse,
  OrderDetail,
  OrderListItem,
} from "../models/orders.model.js";

/** Phase 20.1 — coin/baht ratio. Mirrors wallet.service.ts COINS_PER_BAHT. */
const COINS_PER_BAHT = 10;

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

  // Phase 20.1 — wallet enforcement. Read settings ONCE outside the
  // transaction (cheap cache hit) so we can decide whether to debit
  // the buyer's wallet + credit the sellers'. When walletEnabled=false
  // we skip wallet ops entirely and fall through to the demo-mode
  // checkout flow (no balance check, no coin movement).
  const settings = await getSettings();
  const totalCoins = Math.round(Number(total) * COINS_PER_BAHT);
  // Convert percent → basis-points integer to avoid float drift on
  // fractional fees (e.g. 5.5% → 550 → divisor 10000).
  const platformFeeBp = Math.round(settings.platformFeePercent * 100);

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
        status: "paid",
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

    // Phase 20.1 — wallet debit + per-store credit. Skipped wholesale
    // when wallet is disabled (demo mode) so a fresh checkout still
    // works without a top-up. The debit uses the same `coinPrice`
    // ledger the rest of the wallet ledger speaks; sellers earn
    // (line subtotal × (1 - platformFeePercent / 100)) per store.
    if (settings.walletEnabled && totalCoins > 0) {
      try {
        await debitTx(tx, userId, totalCoins, `order:${order.orderId}`, {
          orderId: order.orderId,
        });
      } catch (e) {
        // Map wallet's 400 InsufficientBalance to HTTP 402 so the
        // checkout client can render a clear "top up first" CTA
        // without sniffing message strings.
        if (e instanceof AppError && e.code === "InsufficientBalance") {
          throw new AppError(402, "InsufficientBalance", e.message);
        }
        throw e;
      }

      // Per-store credit. Group selected items by storeId; for each
      // store, compute its baht subtotal AFTER applying the coupon
      // share (proportional within the coupon's store), convert to
      // coins, apply platform fee, then increment Store.coinBalance.
      const byStore = new Map<number, Prisma.Decimal>();
      for (const ci of selectedItems) {
        const sid = ci.productItem.product.storeId;
        let line = unitPrice(ci).mul(ci.quantity);
        if (
          resolvedCoupon &&
          sid === resolvedCoupon.storeId &&
          couponEligibleSubtotal.gt(0)
        ) {
          // Allocate the coupon discount proportionally to lines
          // within the coupon's store. (Single-store coupon model — if
          // ever multi-store, allocation needs revisiting.)
          const lineShare = line.div(couponEligibleSubtotal);
          line = line.sub(couponDiscount.mul(lineShare));
        }
        byStore.set(sid, (byStore.get(sid) ?? new Prisma.Decimal(0)).add(line));
      }
      for (const [storeId, storeSubtotal] of byStore) {
        const storeCoins = Math.round(Number(storeSubtotal) * COINS_PER_BAHT);
        const credited = Math.floor((storeCoins * (10000 - platformFeeBp)) / 10000);
        if (credited <= 0) continue;
        await tx.store.update({
          where: { storeId },
          data: { coinBalance: { increment: credited } },
        });
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

  return {
    orderId: result.order.orderId,
    transactionId: result.txn.transactionId,
    total: Number(total),
    subtotal: Number(subtotal),
    discount: Number(couponDiscount),
    couponStoreId: resolvedCoupon ? resolvedCoupon.storeId : null,
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
