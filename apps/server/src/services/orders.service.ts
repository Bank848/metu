import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { isConfigured as stripeConfigured, createPaymentIntent, getClient, refreshAccountStatus } from "./stripe.service.js";
import { getSettings } from "./settings.service.js";
import { sendEmail } from "../utils/email.js";
import { renderEmailLayout } from "../utils/email-template.js";
import { capQuantity, loadPurchasableProductItem } from "../utils/purchasable.js";
import { SITE_URL } from "../config.js";
import { audit } from "../utils/audit.js";
import type {
  CheckoutInput,
  CheckoutResponse,
  OrderDetail,
  OrderListItem,
} from "../models/orders.model.js";

// HMAC of orderId + recipient email, truncated to 32 base64url chars.
// Lets the gift email link to a public /gift page that verifies the
// token + the signed-in user's email before disclosing license keys.
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
  // Equal lengths guaranteed by the slice above; timingSafeEqual still
  // throws on mismatched lengths, so wrap defensively.
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
  // Cancel any of this user's still-pending orders before creating a new one.
  // The buyer cancelled out of Stripe / closed the tab and is now retrying;
  // letting both orders sit pending would double-decrement non-digital stock
  // and clutter the orders list with abandoned rows. Restores stock as it
  // goes, so the stock reservation we're about to make below is clean.
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
  // Stale-id check: a buyer who backed out of Stripe and clicked
  // Checkout again may send OLD cartItemIds (cart was recreated; ids
  // changed). Earlier rev silently treated a zero-match as "select
  // everything" — that path silently over-charged buyers who had
  // deselected items. Fail-fast with a clear 400 so the client can
  // refetch the cart and re-confirm what the buyer wants to pay for.
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

  // Gift-form validation. Reject empty/whitespace-only recipient
  // addresses so the buyer can't sneak past the client-side check by
  // submitting a stripped JSON body, and reject self-addressed gifts
  // since those defeat the whole point of the gift flow (and would
  // otherwise let the buyer claim their own gift via /gift/[id]).
  if (input.giftRecipientEmail !== undefined && input.giftRecipientEmail !== null) {
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
    // Replace the input so the rest of checkout sees the trimmed value.
    input = { ...input, giftRecipientEmail: trimmed };
  }

  // defence in depth. Cart's addItem/updateItem already
  // run this gate, but a buyer who held a cart open through a seller
  // pause / store suspension / soft-delete shouldn't be able to push
  // through with a stale row. Each line gets re-validated against the
  // same `loadPurchasableProductItem` rules, and any over-cap quantity
  // is rejected (we don't silently cap at checkout — the buyer needs
  // to see what changed in their cart before paying).
  for (const ci of selectedItems) {
    const fresh = await loadPurchasableProductItem(ci.productItemId);
    const cap = capQuantity(ci.quantity, fresh);
    if (cap < ci.quantity) {
      throw new AppError(
        409,
        "QuantityExceedsCap",
        `"${fresh.product.name}" only allows ${cap} per order — update your cart and try again.`,
        { productItemId: ci.productItemId, cap },
      );
    }
  }

  // Already-owned guard. Non-stackable products (license_key, download,
  // streaming, email) shouldn't ship to the same account twice. Whose
  // ownership we check depends on the order shape:
  //   - Self-purchase: check the BUYER's existing orders.
  //   - Gift: check the RECIPIENT's existing orders if their email
  //     matches a registered user. Otherwise the duplicate check runs
  //     again at /gift/[id] claim time, after the recipient signs in.
  const nonStackableProductIds = selectedItems
    .filter((ci) => !ci.productItem.product.isStackable)
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

  // Active row inside the date window. Note: usage limit + per-user
  // checks happen INSIDE the order transaction below to avoid TOCTOU
  // (parallel checkouts both passing the gate). The unique index
  // on (couponId, userId) provides the per-user enforcement, the
  // count() inside tx provides the global limit enforcement.
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

  // reject zero-total orders (large fixed-coupon abuse).
  if (total.lte(0)) {
    throw new AppError(400, "InvalidTotal", "Order total must be greater than zero.");
  }

  // Single-store + Stripe-configured carts get a real PaymentIntent.
  // multi-store carts are blocked when any store has
  // Stripe connected. Previously the code silently fell back to demo
  // mode, giving the buyer free products from all stores.
  const storeIds = new Set(selectedItems.map((ci) => ci.productItem.product.storeId));
  const singleStoreId = storeIds.size === 1 ? selectedItems[0]!.productItem.product.storeId : null;
  let useStripe = false;
  let sellerStripeAccountId: string | null = null;
  if (stripeConfigured() && singleStoreId !== null) {
    const store = await prisma.store.findUnique({
      where: { storeId: singleStoreId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    });
    // The DB flag can drift from Stripe's runtime state — Stripe might disable
    // charges for the seller (capability lost, identity verification expired,
    // etc.) without our webhook landing in time. Refresh from Stripe before
    // checkout so the buyer doesn't get sent to a Stripe page that immediately
    // errors out at confirm time. One extra API call per checkout is cheap
    // compared to a busted purchase flow.
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
      // Connected but Stripe is restricting the account — silently
      // falling back to demo mode would hand the buyer a free product.
      // Block checkout with a clear message instead.
      throw new AppError(
        400,
        "SellerNotReadyForPayments",
        "This seller hasn't finished setting up payments yet — try another store, or come back later.",
      );
    }
  }
  // Block multi-store checkout when Stripe is live.
  if (storeIds.size > 1 && stripeConfigured()) {
    const anyStoreHasStripe = await prisma.store.count({
      where: {
        storeId: { in: [...storeIds] },
        stripeAccountId: { not: null },
        stripeChargesEnabled: true,
      },
    });
    if (anyStoreHasStripe > 0) {
      throw new AppError(
        400,
        "MultiStoreCheckoutUnsupported",
        "Your cart contains items from multiple stores. Please check out one store at a time.",
      );
    }
  }

  const settings = await getSettings();

  // create PaymentIntent BEFORE the DB transaction so
  // stock is never decremented if Stripe is unavailable. The buyer
  // simply gets a 502 and can retry; no orphaned pending orders.
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
        // All orders start `pending`. Stripe webhook flips to `paid`;
        // demo orders require admin approval.
        status: "pending",
        // Business Rule 4j — payment session lasts 15 minutes. The
        // sweepExpiredOrders cron flips status='cancelled' once
        // expiredAt slips into the past.
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

    // Order has a UNIQUE(cart_id) constraint so each order needs its own
    // cart. Flip the current cart to checked_out, mint a fresh active one,
    // and copy the unselected items + a snapshot of the selected items
    // forward — that way a back-button-out-of-Stripe leaves the buyer's
    // cart intact (items can be retried) while the unique-cart invariant
    // is preserved. cancelUserPendingOrders() above clears any stale
    // pending order before this point so we never double-decrement stock.
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
    // Re-create the selected items in the new cart so /cart still shows
    // what the buyer was about to pay for. They get cleared on payment
    // success via clearCartAfterPayment() in the webhook handler.
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
      // TOCTOU-safe limit check: count INSIDE the tx so
      // a concurrent checkout can't sneak past. The unique
      // (couponId, userId) index prevents the same buyer from
      // double-using; we map the P2002 to a clean 400.
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

  // Update Stripe PI metadata with actual orderId (was placeholder 0).
  if (stripePaymentIntentId && useStripe) {
    try {
      const stripe = getClient();
      await stripe.paymentIntents.update(
        stripePaymentIntentId,
        { metadata: { orderId: String(result.order.orderId) } },
        { stripeAccount: sellerStripeAccountId! },
      );
    } catch {
      // Non-fatal — webhook uses PI metadata but also has order lookup
      // eslint-disable-next-line no-console
      console.warn("[orders.checkout] failed to update PI metadata with orderId");
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
      // crypto.randomInt — predictable license keys would let a single
      // legitimate purchase leak future keys to a piracy ring.
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

// Idempotency cache for sendOrderReceipt. Stripe webhook + buyer-
// triggered /sync can both reach finalizeOrder for the same orderId
// and would otherwise double-fire the receipt email. We can't
// persist a receiptSentAt column without a schema change (out of
// scope for this round), so we combine an in-memory Set with a
// Postgres advisory lock keyed on orderId. The advisory lock makes
// it safe across multiple Node instances on the same DB; the Set
// avoids hammering pg for repeats inside one process.
const receiptSent = new Set<number>();

async function tryAcquireReceiptLock(orderId: number): Promise<boolean> {
  // pg_try_advisory_xact_lock would auto-release at transaction
  // end, but sendOrderReceipt isn't in a transaction here. Use the
  // session-scoped variant + explicit unlock so a crashed call
  // doesn't permanently block the orderId.
  try {
    const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT pg_try_advisory_lock(73310, ${orderId}::int) AS ok
    `;
    return rows[0]?.ok === true;
  } catch {
    // If advisory locks aren't available (e.g. a future non-pg
    // backend), fall back to the in-memory check only.
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
  // Idempotency guard — see comment on receiptSent above.
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

  // Group items by store so the email reads as one section per store
  // (multi-store cart was a documented requirement even though the
  // current Stripe flow constrains to single-store at checkout time).
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
          storeCards.push(
            `<div style="margin-top: 10px;">`,
            `<div style="font-size: 10px; font-weight: 700; color: #b26800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">License key</div>`,
            `<div style="font-family: ui-monospace, 'SF Mono', Menlo, monospace; background: #0f172a; color: #FFCC00; padding: 10px 12px; border-radius: 8px; word-break: break-all; font-size: 13px; letter-spacing: 0.02em;">${escape(it.deliveredKey)}</div>`,
            `</div>`,
          );
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
    // Gift order: buyer NEVER sees the goods, only the recipient does.
    // Send a "Gift sent" confirmation with item names + masked recipient
    // + claim URL the buyer can forward manually if the original email
    // bounced. License keys + download URLs are deliberately omitted so
    // a refund-then-claim play by the buyer can't happen.
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

  // Gift flow — when the buyer ticked "this is a gift" at checkout,
  // also notify the recipient that something's waiting for them. The
  // recipient sees ONLY product names + the buyer's first name + the
  // gift message. License keys, download URLs, store contact details,
  // and buyer's lastName/email are stripped (the recipient never
  // consented to receive that PII; the buyer forwards keys manually).
  if (order.giftRecipientEmail) {
    const recipientSubject = `🎁 ${buyer.firstName} sent you a METU gift — claim it now`;
    // Sanitize buyer-controlled message: strip CR/LF + ANSI + bidi
    // overrides + cap at 500 chars. Without this the plain-text branch
    // lets the buyer inject fake "Subject:"/"From:" lines into the
    // recipient's email client.
    const safeGiftMessage = sanitizePlainTextGiftMessage(order.giftMessage ?? "");
    // HMAC-signed claim token. The /gift page verifies token + the
    // signed-in user's email matches giftRecipientEmail before any
    // license key or download URL is rendered.
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
    // Audit row BEFORE the actual send so SOC has visibility into
    // gift volume even if Resend bounces. recipient_hash is sha256
    // of the lowercased trimmed email — never the raw address — so
    // we can correlate giftspam patterns without keeping recipient
    // PII in the audit log. has_message reveals whether the buyer
    // included a custom note (after sanitization).
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

// Public-by-token gift access. The /gift/:orderId page calls this with
// the URL token + the signed-in user's email (or null). Returns enough
// shape for the page to either render the goods, prompt sign-in, or
// surface a polite "wrong account" error without leaking the recipient
// address to anyone who didn't already have the email.
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

  // Recipient duplicate guard. Non-stackable products (license keys,
  // single-use downloads, streaming, email-delivery) shouldn't land in
  // the same account twice — a recipient who already owns one of the
  // gifted products gets a polite refusal so they can ask the buyer to
  // refund or send something else. Mirrors the checkout-time check on
  // the buyer side, but runs against the recipient's account.
  const recipientUser = await prisma.user.findUnique({
    where: { email: order.giftRecipientEmail.toLowerCase() },
    select: { userId: true },
  });
  if (recipientUser) {
    const nonStackableInGift = full.items
      .filter((it) => it.productItem && !it.productItem.product.isStackable)
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

// Render a redacted card list for the gift recipient. Strips license
// keys, download URLs, and store contact details — those are PII the
// recipient never consented to receive. Buyer forwards delivery
// payload manually if they want.
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

// Sanitize a buyer-controlled gift message for inclusion in BOTH the
// plain-text and HTML email bodies. The HTML branch's escape() handles
// angle brackets but leaves CR/LF/control chars intact; without this
// helper, the plain-text branch (Black-confirmed C2-002) lets the
// attacker inject newlines, fake "Subject:"/"From:" lines that some
// MUA quoted-reply views render verbatim, ANSI escape sequences (CLI
// mail clients), or unicode bidi overrides. Steps:
//   1. Strip ANSI escape (\x1b[...m) and other C0/C1 control chars
//      EXCEPT a tab — keep printable whitespace only.
//   2. Collapse CR/LF runs to a single space (no newline injection).
//   3. Strip unicode bidi overrides (U+202A..U+202E, U+2066..U+2069)
//      so an attacker can't reverse text direction in the recipient
//      preview pane.
//   4. Hard-cap at 500 chars (schema cap is also 500; this is a
//      belt-and-braces in case schema drifts).
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

// Single order; ownership gated via order.userId. When the order was
// placed as a gift, the buyer never gets to see the license keys or
// download URLs — those belong to the recipient. The buyer instead
// gets a giftStatus object so the /orders/:id page can render the
// "sent as a gift" treatment with a copy-link affordance.
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

  // Buyer is the only caller (userId match in the where clause). Strip
  // delivered payloads so the buyer can't sidestep the recipient and
  // claim the gift themselves; the goods stay reachable for the
  // recipient via /gift/:id?t=<token>. Also redact the raw recipient
  // email — only the masked tail surfaces on the buyer's order page.
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
 * Cancel every pending order this user has and restore their stock. Called
 * at the start of each checkout so a buyer who backed out of Stripe and is
 * now retrying doesn't end up with two pending orders fighting for the same
 * inventory.
 */
/**
 * Per CPE241 Business Rule 4j, a pending order's payment session
 * lasts 15 minutes — past that, the order auto-cancels. Order.expiredAt
 * is set to createdAt + 15 minutes; this sweep finds every pending
 * order whose expiredAt has slipped into the past and cancels them in
 * one batch (releasing limited-stock variants the same way
 * cancelUserPendingOrders does).
 *
 * Called from a setInterval at server startup — see app.ts. Returns
 * the count cancelled so the caller can log non-zero sweeps.
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
  // Note: don't restore the checked_out cart here. checkout() already
  // copies the selected items into the fresh active cart at order
  // create time, so the user's /cart shows what they were about to
  // pay for. Restoring an old cart on top of that creates a dual-
  // active-cart bug where /cart flickers between two snapshots.
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

