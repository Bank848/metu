import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { isConfigured as stripeConfigured, createPaymentIntent, getClient, refreshAccountStatus } from "./stripe.service.js";
import { getSettings } from "./settings.service.js";
import { sendEmail } from "../utils/email.js";
import { renderEmailLayout } from "../utils/email-template.js";
import { capQuantity, loadPurchasableProductItem } from "../utils/purchasable.js";
import { SITE_URL } from "../config.js";
import { audit } from "../utils/audit.js";
import { getSettings as getSystemSettings } from "./settings.service.js";
import type {
  CheckoutInput,
  CheckoutResponse,
  OrderDetail,
  OrderListItem,
} from "../models/orders.model.js";

type AuditReq = Pick<Request, "ip" | "headers"> | null | undefined;

// HMAC of orderId + recipient email, truncated to 32 base64url chars.
function giftTokenSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET missing — gift tokens cannot be signed.");
  }
  return s;
}

export function signGiftToken(orderId: number, recipientEmail: string): string {
  const payload = `gift:${orderId}:${recipientEmail.trim().toLowerCase()}`;
  return crypto
    .createHmac("sha256", giftTokenSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyGiftToken(
  orderId: number,
  recipientEmail: string,
  token: string,
): boolean {
  if (typeof token !== "string" || token.length !== 32) return false;
  const expected = signGiftToken(orderId, recipientEmail);
  // timingSafeEqual throws on mismatched buffer lengths.
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/**
 * Checkout. Wraps cart resolution, coupon, line totals, order create,
 * stock decrement, and cart swap in a single Prisma transaction.
 */
export async function checkout(
  userId: number,
  input: CheckoutInput,
): Promise<CheckoutResponse> {
  // Clear any prior pending orders so retries don't double-reserve stock.
  await cancelUserPendingOrders(userId).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[orders.checkout] cancel-pending failed (non-fatal):", err);
  });

  const cart = await prisma.cart.findFirst({
    where: { userId, status: "active" },
    orderBy: { cartId: "desc" }, // latest active cart wins on duplicates
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
  let selectedItems = selectedSet
    ? cart.items.filter((ci) => selectedSet.has(ci.cartItemId))
    : cart.items;
  let unselectedItems = selectedSet
    ? cart.items.filter((ci) => !selectedSet.has(ci.cartItemId))
    : [];
  // Stale-id guard: if selection ids were sent but match nothing, fail
  // loud so the client refetches instead of silently selecting all.
  if (selectedSet && selectedItems.length === 0 && cart.items.length > 0) {
    throw new AppError(
      400,
      "SelectionStale",
      "Cart selection is out of sync. Refresh and re-select what you want to buy.",
    );
  }
  if (selectedItems.length === 0) {
    throw new AppError(400, "EmptyCart", "No items selected for checkout.");
  }

  // Gift-form validation: reject empty/whitespace, malformed, and
  // self-addressed recipient emails. Also gated on the live system
  // settings flag so an admin can disable the entire gift flow from
  // /admin/settings without redeploying.
  if (input.giftRecipientEmail !== undefined && input.giftRecipientEmail !== null) {
    const sys = await getSystemSettings();
    if (!sys.giftingEnabled) {
      throw new AppError(
        400,
        "GiftingDisabled",
        "Gift checkout is currently disabled by the admin. Untick \"This is a gift\" to continue.",
      );
    }
    const trimmed = input.giftRecipientEmail.trim();
    if (!trimmed) {
      throw new AppError(
        400,
        "GiftEmailRequired",
        "Add the recipient's email or untick the gift checkbox before checking out.",
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new AppError(
        400,
        "GiftEmailInvalid",
        "That recipient email doesn't look right.",
      );
    }
    const buyer = await prisma.user.findUnique({
      where: { userId },
      select: { email: true },
    });
    if (
      buyer?.email &&
      trimmed.toLowerCase() === buyer.email.trim().toLowerCase()
    ) {
      throw new AppError(
        400,
        "GiftToSelf",
        "Gifts can't go to your own email — pick a different recipient or untick the gift checkbox.",
      );
    }
    input = { ...input, giftRecipientEmail: trimmed };
  }

  // Re-validate every selected line so a stale / paused / over-cap
  // row can't slip through to payment. Parallel fan-out — sequential
  // awaits added one round-trip per cart item to checkout latency.
  const freshItems = await Promise.all(
    selectedItems.map((ci) => loadPurchasableProductItem(ci.productItemId)),
  );
  selectedItems.forEach((ci, i) => {
    const fresh = freshItems[i]!;
    const cap = capQuantity(ci.quantity, fresh);
    if (cap < ci.quantity) {
      throw new AppError(
        409,
        "QuantityExceedsCap",
        `"${fresh.product.name}" only allows ${cap} per order — update your cart and try again.`,
        { productItemId: ci.productItemId, cap },
      );
    }
  });

  // Already-owned guard. `isStackable` only lifts the guard for the
  // license_key variants on that product — download/streaming/email
  // variants stay single-purchase even on a stackable product, so a
  // buyer can collect multiple keys but can't repurchase the same
  // download. Anything that fails BOTH conditions
  // (product.isStackable AND variant.deliveryMethod === "license_key")
  // falls through to the duplicate check below. Self-purchase checks
  // the buyer; gift checks the recipient if their email is registered
  // (otherwise the gift-claim page rechecks at claim time).
  const nonStackableProductIds = selectedItems
    .filter(
      (ci) =>
        !(ci.productItem.product.isStackable &&
          ci.productItem.deliveryMethod === "license_key"),
    )
    .map((ci) => ci.productItem.product.productId);
  if (nonStackableProductIds.length > 0) {
    let dupeCheckUserId: number | null = null;
    let dupeCheckLabel: "buyer" | "recipient" = "buyer";
    if (input.giftRecipientEmail) {
      const recipient = await prisma.user.findUnique({
        where: { email: input.giftRecipientEmail.toLowerCase() },
        select: { userId: true },
      });
      if (recipient) {
        dupeCheckUserId = recipient.userId;
        dupeCheckLabel = "recipient";
      }
    } else {
      dupeCheckUserId = userId;
    }
    if (dupeCheckUserId !== null) {
      const ownedAlready = await prisma.order.findFirst({
        where: {
          userId: dupeCheckUserId,
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
            select: { productItem: { select: { productId: true, product: { select: { name: true } } } } },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      if (ownedAlready) {
        const ownedProductId = ownedAlready.items[0]?.productItem?.productId;
        const ownedName = ownedAlready.items[0]?.productItem?.product?.name ?? "this product";
        const message =
          dupeCheckLabel === "recipient"
            ? `Your gift recipient already owns "${ownedName}". Pick a different product or recipient.`
            : `Your cart contains a product you already own — view order #${ownedAlready.orderId}.`;
        throw new AppError(
          409,
          dupeCheckLabel === "recipient" ? "RecipientAlreadyOwns" : "AlreadyOwned",
          message,
          { orderId: ownedAlready.orderId, productId: ownedProductId },
        );
      }
    }
  }

  // Resolve active coupon by date window. Usage-limit and per-user
  // enforcement happen inside the order transaction below (TOCTOU-safe).
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

  // Use Decimal so percent discounts don't drift on cents.
  const unitPrice = (ci: (typeof selectedItems)[number]) =>
    new Prisma.Decimal(ci.productItem.price).mul(
      new Prisma.Decimal(100 - (ci.productItem.discountPercent ?? 0)).div(100),
    );

  let subtotal = new Prisma.Decimal(0);
  let couponEligibleSubtotal = new Prisma.Decimal(0);
  // Master coupon (storeId === null) applies platform-wide; per-store
  // coupons only discount lines from that store.
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

  // Free orders (total = 0) are allowed and short-circuit Stripe a
  // few lines below. Only NEGATIVE totals are a bug (a fixed-amount
  // coupon mis-applied beyond the subtotal slipped through earlier
  // capping); reject those.
  if (total.lt(0)) {
    throw new AppError(400, "InvalidTotal", "Order total can't be negative.");
  }
  const isFreeOrder = total.equals(0);

  // Single-store + Stripe-configured carts get a real PaymentIntent.
  // Multi-store checkout is blocked whenever any store has Stripe live.
  // Free orders skip Stripe entirely — there's nothing to charge, so
  // we don't need a payment account configured on the seller.
  const storeIds = new Set(selectedItems.map((ci) => ci.productItem.product.storeId));
  const singleStoreId = storeIds.size === 1 ? selectedItems[0]!.productItem.product.storeId : null;
  let useStripe = false;
  let sellerStripeAccountId: string | null = null;
  if (!isFreeOrder && stripeConfigured() && singleStoreId !== null) {
    const store = await prisma.store.findUnique({
      where: { storeId: singleStoreId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    });
    // Refresh the seller's chargesEnabled flag from Stripe — the DB
    // copy can drift if a webhook was missed.
    let chargesEnabled = Boolean(store?.stripeChargesEnabled);
    if (store?.stripeAccountId) {
      try {
        const fresh = await refreshAccountStatus(singleStoreId);
        chargesEnabled = Boolean(fresh.chargesEnabled);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[orders.checkout] refreshAccountStatus failed; using DB flag:", err);
      }
    }
    if (store?.stripeAccountId && chargesEnabled) {
      useStripe = true;
      sellerStripeAccountId = store.stripeAccountId;
    } else if (store?.stripeAccountId && !chargesEnabled) {
      // Connected but Stripe is restricting the account; block rather
      // than fall back to demo (which would hand out a free product).
      throw new AppError(
        400,
        "SellerNotReadyForPayments",
        "This seller hasn't finished setting up payments yet — try another store, or come back later.",
      );
    }
  }
  // Multi-store checkout: previously rejected when any store had
  // Stripe Connect wired; the user complained that one-bill multi-
  // store was a missing feature. We now allow it, with one big
  // demo-mode caveat: when more than one store is in the cart we
  // skip Stripe entirely (useStripe stays false above because
  // `singleStoreId === null`), so NO real charge happens and items
  // get fulfilled through the demo path. Acceptable for the defense
  // walkthrough; the right long-term fix is to split into N orders
  // / N PaymentIntents (one per store) and confirm each via Stripe
  // Elements in sequence. Tracking issue: see commit history for
  // 2026-05-12 "feat(checkout): allow multi-store cart…".
  if (!isFreeOrder && storeIds.size > 1 && stripeConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(
      "[orders.checkout] multi-store cart → demo path (no Stripe charge) for stores:",
      [...storeIds],
    );
  }

  const settings = await getSettings();

  // Create the PaymentIntent before the DB transaction so a Stripe
  // outage never leaves stock decremented behind an orphaned order.
  let stripeClientSecret: string | null = null;
  let stripePaymentIntentId: string | null = null;
  if (useStripe && sellerStripeAccountId) {
    const buyer = await prisma.user.findUnique({
      where: { userId },
      select: { email: true },
    });
    try {
      const intent = await createPaymentIntent({
        orderId: 0, // placeholder — updated after order row exists
        amountBaht: Number(total),
        sellerStripeAccountId,
        applicationFeePercent: Number(settings.platformFeePercent),
        buyerEmail: buyer?.email,
      });
      stripeClientSecret = intent.clientSecret;
      stripePaymentIntentId = intent.paymentIntentId;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[orders.checkout] Stripe createPaymentIntent failed:", err);
      throw new AppError(
        502,
        "PaymentServiceUnavailable",
        "Payment service is temporarily unavailable. Please try again.",
      );
    }
  }

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
        userId,
        totalPrice: total,
        // Stripe webhook flips this to `paid`; demo orders need admin approval.
        status: "pending",
        // 15-minute payment window; sweepExpiredOrders cron cancels expired.
        expiredAt: new Date(Date.now() + 15 * 60_000),
        stripePaymentIntentId,
        transactionId: txn.transactionId,
        giftRecipientEmail: input.giftRecipientEmail || null,
        giftMessage: input.giftMessage || null,
        items: {
          create: selectedItems.map((ci) => ({
            productItemId: ci.productItemId,
            quantity: ci.quantity,
            pricePerUnit: unitPrice(ci),
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

    // UNIQUE(cart_id) on Order means each order needs its own cart.
    // Flip the current to checked_out, mint a fresh active one, and
    // forward unselected + snapshot of selected items so the buyer's
    // /cart still reflects what they were paying for.
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
    // Re-create the selected items in the new cart; cleared by
    // clearCartAfterPayment() once the webhook confirms payment.
    for (const ci of selectedItems) {
      await tx.cartItem.create({
        data: {
          cartId: newCart.cartId,
          productItemId: ci.productItemId,
          quantity: ci.quantity,
        },
      });
    }
    if (resolvedCoupon) {
      // TOCTOU-safe count inside the tx; unique (couponId, userId)
      // index handles per-user double-use (P2002 → 400).
      const usedSoFar = await tx.couponUsage.count({
        where: { couponId: resolvedCoupon.couponId },
      });
      if (usedSoFar >= resolvedCoupon.usageLimit) {
        throw new AppError(400, "CouponLimitReached", "This coupon has reached its usage limit.");
      }
      try {
        await tx.couponUsage.create({
          data: { couponId: resolvedCoupon.couponId, userId },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new AppError(400, "CouponAlreadyUsed", "You have already used this coupon.");
        }
        throw err;
      }
    }
    return { order, txn };
  });

  // Patch the PI metadata with the real orderId (was a 0 placeholder).
  if (stripePaymentIntentId && useStripe) {
    try {
      const stripe = getClient();
      await stripe.paymentIntents.update(
        stripePaymentIntentId,
        { metadata: { orderId: String(result.order.orderId) } },
        { stripeAccount: sellerStripeAccountId! },
      );
    } catch {
      // Non-fatal: webhook also has order lookup as a fallback.
      // eslint-disable-next-line no-console
      console.warn("[orders.checkout] failed to update PI metadata with orderId");
    }
  }

  // Auto-fulfill paths that don't go through Stripe:
  //   • Free orders (total = 0) — buyer paid nothing, just hand over
  //     the goods immediately.
  //   • Multi-store carts when at least one store has Stripe wired —
  //     Stripe Connect charges a single connected account, so we
  //     can't route a multi-store payment through one PaymentIntent.
  //     Defense-day demo mode: skip the charge entirely and fulfill
  //     for free. Tracked as known limitation; long-term fix is to
  //     split into N orders + N PaymentIntents (one per store).
  //   • Demo mode (no Stripe wired at all) — same path.
  //
  // Without this branch the order would stay PENDING forever
  // because no webhook will ever fire.
  const shouldAutoFulfill = !useStripe; // covers all three cases above
  if (shouldAutoFulfill) {
    await prisma.order.update({
      where: { orderId: result.order.orderId },
      data: { status: "paid" },
    });
    await clearCartAfterPayment(userId, result.order.orderId).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[orders.checkout] auto-fulfill cart cleanup failed:", err);
    });
    await finalizeOrder(result.order.orderId);
  }

  return {
    orderId: result.order.orderId,
    transactionId: result.txn.transactionId,
    total: Number(total),
    subtotal: Number(subtotal),
    discount: Number(couponDiscount),
    couponStoreId: resolvedCoupon ? resolvedCoupon.storeId : null,
    stripeClientSecret,
    /** When true the order is already paid + fulfilled — frontend can
     *  skip the Stripe redirect and go straight to /orders/[id]. */
    freeOrder: isFreeOrder,
  };
}

/**
 * Generate a fresh PaymentIntent for an existing pending order. Used when the
 * buyer cancelled out of the Stripe page (browser back, closed window, etc.)
 * and now wants to retry without losing the cart items the order already locked.
 */
export async function retryOrderPayment(
  userId: number,
  orderId: number,
): Promise<{ clientSecret: string }> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      items: {
        include: { productItem: { include: { product: { select: { storeId: true } } } } },
      },
    },
  });
  if (!order || order.userId !== userId) {
    throw new AppError(404, "OrderNotFound", "Order not found.");
  }
  if (order.status !== "pending") {
    throw new AppError(400, "OrderNotPending", "This order can no longer accept a payment.");
  }
  if (!stripeConfigured()) {
    throw new AppError(503, "StripeNotConfigured", "Payments are temporarily unavailable.");
  }
  const storeIds = new Set(
    order.items
      .map((it) => it.productItem?.product.storeId)
      .filter((s): s is number => s !== undefined),
  );
  if (storeIds.size !== 1) {
    throw new AppError(400, "MultiStoreCheckoutUnsupported", "Cannot retry a multi-store order.");
  }
  const storeId = [...storeIds][0]!;
  const store = await prisma.store.findUnique({
    where: { storeId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  if (!store?.stripeAccountId || !store.stripeChargesEnabled) {
    throw new AppError(
      400,
      "SellerNotReadyForPayments",
      "This seller hasn't finished setting up payments yet.",
    );
  }

  const settings = await getSettings();
  const buyer = await prisma.user.findUnique({
    where: { userId },
    select: { email: true },
  });
  const intent = await createPaymentIntent({
    orderId,
    amountBaht: Number(order.totalPrice),
    sellerStripeAccountId: store.stripeAccountId,
    applicationFeePercent: Number(settings.platformFeePercent),
    buyerEmail: buyer?.email,
  });
  await prisma.order.update({
    where: { orderId },
    data: { stripePaymentIntentId: intent.paymentIntentId },
  });
  return { clientSecret: intent.clientSecret };
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
      // crypto.randomInt — license keys must not be guessable.
      block += alphabet[crypto.randomInt(0, alphabet.length)];
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
    if (!pi) continue;
    let key: string | null = null;
    let url: string | null = null;
    switch (pi.deliveryMethod) {
      case "license_key":
      case "email": {
        // Generate one key per unit so a stackable license_key purchase
        // (qty > 1) actually delivers the keys the buyer paid for.
        // Stored newline-joined in deliveredKey; the order detail page
        // splits and renders them as a list.
        const count = Math.max(1, item.quantity ?? 1);
        const keys: string[] = [];
        for (let i = 0; i < count; i++) {
          keys.push(generateLicenseKey(pi.licenseKeyTemplate));
        }
        key = keys.join("\n");
        break;
      }
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

// Idempotency for sendOrderReceipt: in-memory Set + Postgres advisory
// lock so multi-instance + multi-call (webhook + /sync) don't double-send.
const receiptSent = new Set<number>();

async function tryAcquireReceiptLock(orderId: number): Promise<boolean> {
  // Session-scoped lock + explicit unlock so a crash doesn't pin the orderId.
  try {
    const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT pg_try_advisory_lock(73310, ${orderId}::int) AS ok
    `;
    return rows[0]?.ok === true;
  } catch {
    // Non-pg backend: fall back to the in-memory Set only.
    return true;
  }
}

async function releaseReceiptLock(orderId: number): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(73310, ${orderId}::int)`;
  } catch {
    // best-effort
  }
}

// Render + send the buyer's receipt email, grouped by store.
export async function sendOrderReceipt(orderId: number): Promise<void> {
  if (receiptSent.has(orderId)) return;
  const got = await tryAcquireReceiptLock(orderId);
  if (!got) return;
  try {
    if (receiptSent.has(orderId)) return;
    receiptSent.add(orderId);
    await sendOrderReceiptInner(orderId);
  } finally {
    await releaseReceiptLock(orderId);
  }
}

async function sendOrderReceiptInner(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      user: { select: { email: true, firstName: true } },
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
  const buyer = order.user;
  if (!buyer?.email) return;

  // Group items by store so each store renders as its own section.
  type StoreInfo = { storeId: number; name: string; contactEmail: string | null; phone: string | null };
  type Bucket = { store: StoreInfo; lines: typeof order.items };
  const ORPHAN_STORE_ID = -1;
  const byStore = new Map<number, Bucket>();
  for (const it of order.items) {
    const store = it.productItem?.product.store;
    const sid = store?.storeId ?? ORPHAN_STORE_ID;
    const storeInfo: StoreInfo = store
      ? store
      : { storeId: ORPHAN_STORE_ID, name: "(deleted store)", contactEmail: null, phone: null };
    const bucket = byStore.get(sid) ?? { store: storeInfo, lines: [] };
    bucket.lines.push(it);
    byStore.set(sid, bucket);
  }
  const stores = [...byStore.values()];

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const isGift = Boolean(order.giftRecipientEmail);

  if (!isGift) {
    // Self-purchase: full receipt with license keys + download links.
    const subject =
      stores.length === 1
        ? `Your METU order #${orderId} — items from ${stores[0]!.store.name}`
        : `Your METU order #${orderId} — items from ${stores.length} stores`;

    const textLines: string[] = [
      `Hi ${buyer.firstName},`,
      "",
      "Thanks for your purchase. Your payment has cleared and the items below are ready.",
      "",
    ];
    for (const { store, lines } of stores) {
      textLines.push(`── ${store.name} ──`);
      for (const it of lines) {
        const name = it.productItem?.product.name ?? it.productNameSnapshot;
        textLines.push(`  ${it.quantity}× ${name}`);
        if (it.deliveredKey) {
          const keys = it.deliveredKey.split("\n").map((k) => k.trim()).filter(Boolean);
          if (keys.length === 1) {
            textLines.push(`     License key: ${keys[0]}`);
          } else {
            textLines.push(`     License keys (${keys.length}):`);
            keys.forEach((k, i) => textLines.push(`       ${i + 1}. ${k}`));
          }
        }
        if (it.deliveredUrl) textLines.push(`     Download: ${it.deliveredUrl}`);
      }
      const contact: string[] = [];
      if (store.contactEmail) contact.push(`email ${store.contactEmail}`);
      if (store.phone) contact.push(`phone ${store.phone}`);
      if (contact.length) textLines.push(`  Contact ${store.name}: ${contact.join(" · ")}`);
      textLines.push("");
    }
    textLines.push(
      `View on the site: ${SITE_URL}/orders/${orderId}`,
      "",
      "— METU Marketplace",
    );

    const storeCards: string[] = [];
    for (const { store, lines } of stores) {
      storeCards.push(
        `<div style="margin: 20px 0 0; border: 1px solid #f1e5b8; border-radius: 14px; padding: 18px 20px; background: #fffdf5;">`,
        `<div style="display: inline-block; background: #FFCC00; color: #1a1919; font-weight: 800; font-size: 11px; padding: 5px 11px; border-radius: 999px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px;">${escape(store.name)}</div>`,
      );
      for (const it of lines) {
        const name = escape(it.productItem?.product.name ?? it.productNameSnapshot);
        storeCards.push(
          `<div style="margin: 10px 0; padding: 14px 16px; background: #ffffff; border: 1px solid #efe7c4; border-radius: 12px;">`,
          `<div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">${it.quantity}&times; ${name}</div>`,
        );
        if (it.deliveredKey) {
          const keys = it.deliveredKey.split("\n").map((k) => k.trim()).filter(Boolean);
          const label = keys.length > 1 ? `License keys (${keys.length})` : "License key";
          storeCards.push(
            `<div style="margin-top: 10px;">`,
            `<div style="font-size: 10px; font-weight: 700; color: #b26800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">${label}</div>`,
          );
          for (const k of keys) {
            storeCards.push(
              `<div style="font-family: ui-monospace, 'SF Mono', Menlo, monospace; background: #0f172a; color: #FFCC00; padding: 10px 12px; border-radius: 8px; word-break: break-all; font-size: 13px; letter-spacing: 0.02em; margin-bottom: 6px;">${escape(k)}</div>`,
            );
          }
          storeCards.push(`</div>`);
        }
        if (it.deliveredUrl) {
          storeCards.push(
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px;"><tr><td style="border-radius: 999px; background: linear-gradient(180deg, #FFCC00 0%, #B26800 100%); box-shadow: 0 3px 10px -4px rgba(178,104,0,0.5);"><a href="${escape(it.deliveredUrl)}" style="display: inline-block; padding: 10px 22px; font-size: 13px; font-weight: 700; color: #1a1919; text-decoration: none; letter-spacing: 0.01em;">Download &rarr;</a></td></tr></table>`,
          );
        }
        storeCards.push(`</div>`);
      }
      const contact: string[] = [];
      if (store.contactEmail) contact.push(`<a href="mailto:${escape(store.contactEmail)}" style="color: #b26800; text-decoration: none; font-weight: 600;">${escape(store.contactEmail)}</a>`);
      if (store.phone) contact.push(escape(store.phone));
      if (contact.length) {
        storeCards.push(
          `<div style="font-size: 12px; color: #64748b; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #efe7c4;">Contact ${escape(store.name)}: ${contact.join(" &middot; ")}</div>`,
        );
      }
      storeCards.push(`</div>`);
    }

    const html = renderEmailLayout({
      heading: `Order #${orderId} confirmed — your downloads are ready`,
      intro: `Hi <strong>${escape(buyer.firstName)}</strong>, payment cleared. License keys and download links are below, and everything stays available on your METU account whenever you need it again.`,
      cta: { label: "View order", url: `${SITE_URL}/orders/${orderId}` },
      bodyHtml: storeCards.join(""),
    });

    await sendEmail({
      to: buyer.email,
      subject,
      html,
      text: textLines.join("\n"),
    });
  } else {
    // Gift order: buyer gets a confirmation with item names + masked
    // recipient + a forwardable claim URL. License keys / download
    // URLs are omitted so the buyer can't refund-then-claim.
    const recipientMasked = maskEmailForDisplay(order.giftRecipientEmail!);
    const claimToken = signGiftToken(orderId, order.giftRecipientEmail!);
    const claimUrl = `${SITE_URL}/gift/${orderId}?t=${claimToken}`;
    const subject = `Your gift is on its way 🎁 — order #${orderId}`;

    const textLines: string[] = [
      `Hi ${buyer.firstName},`,
      "",
      `Your gift order #${orderId} is confirmed. We've emailed ${recipientMasked} a private link to claim it.`,
      "",
      "Items:",
    ];
    for (const { store, lines } of stores) {
      for (const it of lines) {
        const name = it.productItem?.product.name ?? it.productNameSnapshot;
        textLines.push(`  ${it.quantity}× ${name} — ${store.name}`);
      }
    }
    textLines.push(
      "",
      `If your recipient doesn't see the email, forward this private link to them:`,
      claimUrl,
      "",
      "License keys and download links never appear in your account on gift orders — only your recipient can unlock them. This is by design so the gift stays theirs.",
      "",
      "— METU Marketplace",
    );

    const giftItemCards: string[] = [];
    for (const { store, lines } of stores) {
      giftItemCards.push(
        `<div style="margin: 20px 0 0; border: 1px solid #f1e5b8; border-radius: 14px; padding: 18px 20px; background: #fffdf5;">`,
        `<div style="display: inline-block; background: #FFCC00; color: #1a1919; font-weight: 800; font-size: 11px; padding: 5px 11px; border-radius: 999px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px;">${escape(store.name)}</div>`,
      );
      for (const it of lines) {
        const name = escape(it.productItem?.product.name ?? it.productNameSnapshot);
        giftItemCards.push(
          `<div style="margin: 10px 0; padding: 14px 16px; background: #ffffff; border: 1px solid #efe7c4; border-radius: 12px; font-size: 14px; font-weight: 700; color: #0f172a;">${it.quantity}&times; ${name}</div>`,
        );
      }
      giftItemCards.push(`</div>`);
    }
    giftItemCards.push(
      `<div style="margin: 24px 0 0; padding: 14px 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px;">`,
      `<div style="font-size: 11px; font-weight: 700; color: #b26800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Heads up</div>`,
      `<div style="font-size: 13px; color: #713f12; line-height: 1.55;">License keys and download links never show up on your account for gift orders &mdash; only the recipient can unlock them. If the recipient&rsquo;s inbox didn&rsquo;t catch the claim email, copy the private link from your order page on METU and forward it yourself.</div>`,
      `</div>`,
    );

    const html = renderEmailLayout({
      heading: `🎁 Your gift to ${escape(recipientMasked)} is on its way`,
      intro: `Hi <strong>${escape(buyer.firstName)}</strong>, payment cleared and we just emailed your recipient a private claim link. They&rsquo;ll need to sign in (or create a free account) with this same email address to unlock the gift.`,
      cta: { label: "View gift status", url: `${SITE_URL}/orders/${orderId}` },
      bodyHtml: giftItemCards.join(""),
    });

    await sendEmail({
      to: buyer.email,
      subject,
      html,
      text: textLines.join("\n"),
    });
  }

  // Notify the gift recipient. They see only product names + buyer
  // first name + sanitized gift message — no keys/URLs/store contacts.
  if (order.giftRecipientEmail) {
    const recipientSubject = `🎁 ${buyer.firstName} sent you a METU gift — claim it now`;
    // Sanitize buyer-controlled message before embedding in email.
    const safeGiftMessage = sanitizePlainTextGiftMessage(order.giftMessage ?? "");
    // HMAC-signed claim token, verified at /gift page.
    const claimToken = signGiftToken(orderId, order.giftRecipientEmail);
    const claimUrl = `${SITE_URL}/gift/${orderId}?t=${claimToken}`;
    const giftIntroText = `${buyer.firstName} just bought you a digital gift on METU. Click the link below and sign in (or create a free account) with this email address to claim it.${safeGiftMessage ? `\n\nMessage from ${buyer.firstName}: "${safeGiftMessage}"` : ""}`;
    const giftIntroHtml = `<p>${escape(buyer.firstName)} just bought you a digital gift on METU. Tap the button below and sign in (or create a free account) with this email address to claim it.</p>${safeGiftMessage ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 18px 0 4px;"><tr><td style="background: #fffbeb; border-left: 4px solid #FFCC00; border-radius: 8px; padding: 14px 16px;"><div style="font-size: 10px; font-weight: 700; color: #b26800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Note from ${escape(buyer.firstName)}</div><div style="font-size: 14px; color: #713f12; font-style: italic; line-height: 1.55;">${escape(safeGiftMessage)}</div></td></tr></table>` : ""}`;
    const recipientCards = buildRecipientStoreCards(stores, escape);
    const recipientText = buildRecipientStoreText(stores);
    const giftHtml = renderEmailLayout({
      heading: `🎁 A gift from ${escape(buyer.firstName)}`,
      intro: giftIntroHtml,
      cta: { label: "Claim your gift", url: claimUrl },
      fallbackUrl: claimUrl,
      bodyHtml: recipientCards.join(""),
    });
    const giftText = [
      `Hi!`,
      "",
      giftIntroText,
      "",
      `Claim it: ${claimUrl}`,
      "",
      ...recipientText,
      "Sign in with the email this message was sent to — that's how METU knows the gift is yours.",
      "",
      "— METU Marketplace",
    ].join("\n");
    // Audit before send so we capture volume even on bounce. We log
    // a sha256 of the recipient email, not the raw address.
    const recipientNormalized = order.giftRecipientEmail.trim().toLowerCase();
    const recipientHash = crypto
      .createHash("sha256")
      .update(recipientNormalized)
      .digest("hex");
    await audit({
      actorId: order.userId ?? null,
      action: "order.gift.sent",
      targetType: "order",
      targetId: orderId,
      meta: {
        recipient_hash: recipientHash,
        has_message: safeGiftMessage.length > 0,
        message_len: safeGiftMessage.length,
      },
      req: null,
    });
    await sendEmail({
      to: order.giftRecipientEmail,
      subject: recipientSubject,
      html: giftHtml,
      text: giftText,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[order] gift recipient email failed:", err);
    });
  }
}

// Mask an email for display: head two chars + ****** + @domain.
function maskEmailForDisplay(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***";
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

// Public-by-token gift access. /gift/:orderId calls this with the URL
// token + the signed-in user's email; returns one of several shapes
// without leaking the recipient address.
export type GiftItem = {
  orderItemId: number;
  quantity: number;
  name: string;
  deliveredKey: string | null;
  deliveredUrl: string | null;
};
export type GiftStoreBucket = {
  storeId: number;
  storeName: string;
  items: GiftItem[];
};
export type GiftAccessResult =
  | { status: "not-found" }
  | { status: "no-gift" }
  | { status: "invalid-token" }
  | { status: "needs-auth"; recipientMasked: string }
  | { status: "wrong-email"; recipientMasked: string }
  | {
      status: "already-owned";
      recipientMasked: string;
      duplicateProductNames: string[];
    }
  | {
      status: "ok";
      orderId: number;
      buyerFirstName: string;
      giftMessage: string | null;
      recipientMasked: string;
      stores: GiftStoreBucket[];
    };

export async function getGiftAccess(
  orderId: number,
  token: string,
  currentUserEmail: string | null,
): Promise<GiftAccessResult> {
  if (!Number.isFinite(orderId) || orderId <= 0) return { status: "not-found" };
  const order = await prisma.order.findUnique({
    where: { orderId },
    select: {
      orderId: true,
      userId: true,
      giftRecipientEmail: true,
      giftMessage: true,
      user: { select: { firstName: true } },
    },
  });
  if (!order) return { status: "not-found" };
  if (!order.giftRecipientEmail) return { status: "no-gift" };
  if (!verifyGiftToken(orderId, order.giftRecipientEmail, token)) {
    return { status: "invalid-token" };
  }

  const recipientMasked = maskEmailForDisplay(order.giftRecipientEmail);
  if (!currentUserEmail) {
    return { status: "needs-auth", recipientMasked };
  }
  if (currentUserEmail.trim().toLowerCase() !== order.giftRecipientEmail.trim().toLowerCase()) {
    return { status: "wrong-email", recipientMasked };
  }

  // Authed + email matches — load full delivery payloads.
  const full = await prisma.order.findUnique({
    where: { orderId },
    include: {
      items: {
        include: {
          productItem: {
            include: {
              product: {
                include: {
                  store: { select: { storeId: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!full) return { status: "not-found" };

  // Recipient-side duplicate guard. Mirrors the buyer-side check at
  // checkout time — `isStackable` only lifts the guard for license_key
  // variants, so a gifted download still gets blocked if the
  // recipient already owns it.
  const recipientUser = await prisma.user.findUnique({
    where: { email: order.giftRecipientEmail.toLowerCase() },
    select: { userId: true },
  });
  if (recipientUser) {
    const nonStackableInGift = full.items
      .filter(
        (it) =>
          it.productItem &&
          !(it.productItem.product.isStackable &&
            it.productItem.deliveryMethod === "license_key"),
      )
      .map((it) => ({
        productId: it.productItem!.product.productId,
        name: it.productItem!.product.name,
      }));
    if (nonStackableInGift.length > 0) {
      const dupes = await prisma.order.findMany({
        where: {
          userId: recipientUser.userId,
          orderId: { not: orderId },
          status: { in: ["paid", "fulfilled", "pending"] },
          items: {
            some: {
              productItem: {
                productId: { in: nonStackableInGift.map((p) => p.productId) },
              },
            },
          },
        },
        select: {
          items: {
            where: {
              productItem: {
                productId: { in: nonStackableInGift.map((p) => p.productId) },
              },
            },
            select: { productItem: { select: { productId: true } } },
          },
        },
      });
      const dupeProductIds = new Set(
        dupes.flatMap((o) =>
          o.items
            .map((i) => i.productItem?.productId)
            .filter((id): id is number => typeof id === "number"),
        ),
      );
      const duplicateProductNames = nonStackableInGift
        .filter((p) => dupeProductIds.has(p.productId))
        .map((p) => p.name);
      if (duplicateProductNames.length > 0) {
        return { status: "already-owned", recipientMasked, duplicateProductNames };
      }
    }
  }

  const ORPHAN = -1;
  const byStore = new Map<number, GiftStoreBucket>();
  for (const it of full.items) {
    const store = it.productItem?.product.store;
    const sid = store?.storeId ?? ORPHAN;
    const bucket = byStore.get(sid) ?? {
      storeId: sid,
      storeName: store?.name ?? "(deleted store)",
      items: [],
    };
    bucket.items.push({
      orderItemId: it.orderItemId,
      quantity: it.quantity,
      name: it.productItem?.product.name ?? it.productNameSnapshot,
      deliveredKey: it.deliveredKey,
      deliveredUrl: it.deliveredUrl,
    });
    byStore.set(sid, bucket);
  }

  await audit({
    actorId: null,
    action: "order.gift.viewed",
    targetType: "order",
    targetId: orderId,
    meta: {
      recipient_hash: crypto
        .createHash("sha256")
        .update(order.giftRecipientEmail.trim().toLowerCase())
        .digest("hex"),
    },
    req: null,
  });

  return {
    status: "ok",
    orderId,
    buyerFirstName: order.user?.firstName ?? "Someone",
    giftMessage: order.giftMessage,
    recipientMasked,
    stores: [...byStore.values()],
  };
}

// Render the recipient-facing card list with keys / URLs / store
// contact details stripped (recipient PII minimization).
function buildRecipientStoreCards(
  stores: Array<{ store: { name: string }; lines: Array<{ quantity: number; productItem: { product: { name: string } } | null; productNameSnapshot: string }> }>,
  escape: (s: string) => string,
): string[] {
  const cards: string[] = [];
  for (const { store, lines } of stores) {
    cards.push(
      `<div style="margin: 20px 0 0; border: 1px solid #f1e5b8; border-radius: 14px; padding: 18px 20px; background: #fffdf5;">`,
      `<div style="display: inline-block; background: #FFCC00; color: #1a1919; font-weight: 800; font-size: 11px; padding: 5px 11px; border-radius: 999px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px;">${escape(store.name)}</div>`,
    );
    for (const it of lines) {
      const name = escape(it.productItem?.product.name ?? it.productNameSnapshot);
      cards.push(
        `<div style="margin: 10px 0; padding: 14px 16px; background: #ffffff; border: 1px solid #efe7c4; border-radius: 12px;">`,
        `<div style="font-size: 14px; font-weight: 700; color: #0f172a;">${it.quantity}&times; ${name}</div>`,
        `</div>`,
      );
    }
    cards.push(`</div>`);
  }
  return cards;
}

// Sanitize buyer-controlled gift message: strip ANSI / C0 / C1 / DEL,
// collapse CR/LF runs to spaces, strip unicode bidi controls, and cap
// at 500 chars. Defends against header-injection in the plain-text body.
function sanitizePlainTextGiftMessage(input: string): string {
  if (!input) return "";
  let s = input;
  // ANSI CSI (ESC + '[' + params + final byte). Strip the whole
  // sequence; we don't try to "preserve" colour codes.
  s = s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  // Other C0 (0x00-0x1F except \t) + C1 (0x80-0x9F) + DEL (0x7F).
  s = s.replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, "");
  // CR/LF runs collapse to a single space.
  s = s.replace(/[\r\n]+/g, " ");
  // Tab → single space (avoid weird alignment in plain-text MUA).
  s = s.replace(/\t+/g, " ");
  // Unicode bidi controls.
  s = s.replace(/[‪-‮⁦-⁩]/g, "");
  // Collapse multi-space runs introduced by the substitutions.
  s = s.replace(/ {2,}/g, " ").trim();
  // Hard cap.
  if (s.length > 500) s = s.slice(0, 500);
  return s;
}

function buildRecipientStoreText(
  stores: Array<{ store: { name: string }; lines: Array<{ quantity: number; productItem: { product: { name: string } } | null; productNameSnapshot: string }> }>,
): string[] {
  const out: string[] = [];
  for (const { store, lines } of stores) {
    out.push(`── ${store.name} ──`);
    for (const it of lines) {
      const name = it.productItem?.product.name ?? it.productNameSnapshot;
      out.push(`  ${it.quantity}× ${name}`);
    }
    out.push("");
  }
  return out;
}

// List the user's orders newest first.
export async function listForUser(userId: number): Promise<OrderListItem[]> {
  return prisma.order.findMany({
    where: { userId },
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

// Single order; ownership gated via order.userId. Gift orders strip
// delivery payloads and return a giftStatus block instead.
export async function findByIdForUser(
  userId: number,
  orderId: number,
): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { orderId, userId },
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
  if (!order) return null;

  const isGift = Boolean(order.giftRecipientEmail);
  if (!isGift) {
    // Plain self-purchase — no redaction, no gift block.
    return {
      ...order,
      giftStatus: { isGift: false, recipientMasked: null, claimUrl: null },
    } as OrderDetail;
  }

  // Strip delivered payloads + raw recipient email; the buyer only
  // sees the masked recipient and a forwardable claim URL.
  const recipientEmail = order.giftRecipientEmail!;
  const claimToken = signGiftToken(order.orderId, recipientEmail);
  const redactedItems = order.items.map((it) => ({
    ...it,
    deliveredKey: null,
    deliveredUrl: null,
  }));
  return {
    ...order,
    items: redactedItems,
    giftRecipientEmail: null,
    giftStatus: {
      isGift: true,
      recipientMasked: maskEmailForDisplay(recipientEmail),
      claimUrl: `${SITE_URL}/gift/${order.orderId}?t=${claimToken}`,
    },
  } as OrderDetail;
}

/**
 * Buyer takes back a gift they accidentally sent. Strict policy:
 * blocked the moment the recipient has even opened /gift/[id] (we
 * gate on the order.gift.viewed audit row from getGiftAccess). On
 * success we null the gift fields so findByIdForUser stops redacting,
 * and emit order.gift.reclaimed_by_buyer for the audit-log trail.
 */
export async function reclaimGiftAsBuyer(
  userId: number,
  orderId: number,
  req: AuditReq,
): Promise<{ ok: true }> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    select: { orderId: true, userId: true, giftRecipientEmail: true, status: true },
  });
  if (!order || order.userId !== userId || !order.giftRecipientEmail) {
    throw new AppError(404, "OrderNotFound");
  }
  if (order.status !== "paid" && order.status !== "fulfilled") {
    throw new AppError(409, "InvalidStatus", "You can only reclaim a paid or fulfilled gift order.");
  }

  const viewed = await prisma.auditLog.findFirst({
    where: {
      action: "order.gift.viewed",
      targetType: "order",
      targetId: orderId,
    },
    select: { logId: true },
  });
  if (viewed) {
    await audit({
      actorId: userId,
      action: "order.gift.reclaim_blocked",
      targetType: "order",
      targetId: orderId,
      meta: { reason: "recipient_already_viewed" },
      req,
    });
    throw new AppError(
      409,
      "RecipientAlreadyViewed",
      "Your recipient already opened this gift, so it can't be reclaimed. Ask the seller for a refund instead.",
    );
  }

  const recipientHash = crypto
    .createHash("sha256")
    .update(order.giftRecipientEmail.trim().toLowerCase())
    .digest("hex");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { orderId },
      data: { giftRecipientEmail: null, giftMessage: null },
    });
  });

  await audit({
    actorId: userId,
    action: "order.gift.reclaimed_by_buyer",
    targetType: "order",
    targetId: orderId,
    meta: { recipient_hash: recipientHash },
    req,
  });

  return { ok: true };
}

/**
 * Sweep pending orders past their 15-minute payment window: cancel
 * them and restore non-digital stock. Called from a setInterval in
 * app.ts; returns the count cancelled.
 */
export async function sweepExpiredOrders(): Promise<number> {
  const expired = await prisma.order.findMany({
    where: {
      status: "pending",
      expiredAt: { lt: new Date(), not: null },
    },
    select: { orderId: true },
    take: 200, // cap per sweep so a backlog can't lock the server
  });
  if (expired.length === 0) return 0;
  const DIGITAL_METHODS = new Set(["download", "email", "license_key", "streaming"]);
  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({
        where: { orderId: order.orderId },
        select: { status: true, items: { select: { productItemId: true, quantity: true } } },
      });
      if (!fresh || fresh.status !== "pending") return;
      for (const item of fresh.items) {
        if (item.productItemId == null) continue;
        const pi = await tx.productItem.findUnique({
          where: { productItemId: item.productItemId },
          select: { deliveryMethod: true },
        });
        if (!pi || DIGITAL_METHODS.has(pi.deliveryMethod)) continue;
        await tx.productItem.update({
          where: { productItemId: item.productItemId },
          data: { quantity: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { orderId: order.orderId },
        data: { status: "cancelled" },
      });
    });
  }
  return expired.length;
}

export async function cancelUserPendingOrders(userId: number): Promise<void> {
  const pending = await prisma.order.findMany({
    where: { userId, status: "pending" },
    select: { orderId: true },
  });
  if (pending.length === 0) return;
  const DIGITAL_METHODS = new Set(["download", "email", "license_key", "streaming"]);
  for (const order of pending) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({
        where: { orderId: order.orderId },
        select: { status: true, items: { select: { productItemId: true, quantity: true } } },
      });
      if (!fresh || fresh.status !== "pending") return;
      for (const item of fresh.items) {
        if (item.productItemId == null) continue;
        const pi = await tx.productItem.findUnique({
          where: { productItemId: item.productItemId },
          select: { deliveryMethod: true },
        });
        if (!pi || DIGITAL_METHODS.has(pi.deliveryMethod)) continue;
        await tx.productItem.update({
          where: { productItemId: item.productItemId },
          data: { quantity: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { orderId: order.orderId },
        data: { status: "cancelled" },
      });
    });
  }
  // Don't restore the checked_out cart — checkout() already copied the
  // selected items into the new active cart, and restoring would leave
  // two carts active at once.
}

/**
 * Remove a paid order's items from the user's active cart. Called from the
 * Stripe webhook once payment is confirmed — the items are no longer
 * "pending purchase" so they shouldn't keep showing in /cart. The cart row
 * itself stays active so unrelated items still in the cart are preserved.
 */
export async function clearCartAfterPayment(userId: number, orderId: number): Promise<void> {
  const active = await prisma.cart.findFirst({
    where: { userId, status: "active" },
    orderBy: { cartId: "desc" }, // latest active cart wins on duplicates
    select: { cartId: true },
  });
  if (!active) return;
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productItemId: true },
  });
  if (orderItems.length === 0) return;
  const productItemIds = orderItems
    .map((it) => it.productItemId)
    .filter((id): id is number => id !== null);
  if (productItemIds.length === 0) return;
  await prisma.cartItem.deleteMany({
    where: {
      cartId: active.cartId,
      productItemId: { in: productItemIds },
    },
  });
}

