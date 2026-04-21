import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { checkoutSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "ValidationError" }, { status: 400 });
  const { couponCode, selectedCartItemIds } = parsed.data;

  const cart = await prisma.cart.findFirst({
    where: { userId: r.auth.uid, status: "active" },
    include: { items: { include: { productItem: { include: { product: true } } } } },
  });
  if (!cart || cart.items.length === 0) return NextResponse.json({ error: "EmptyCart" }, { status: 400 });

  // Partial checkout: only the checked items become an order; unchecked
  // items get re-parented to the user's new active cart at the end.
  const selectedSet = selectedCartItemIds && selectedCartItemIds.length
    ? new Set(selectedCartItemIds)
    : null;
  const selectedItems = selectedSet
    ? cart.items.filter((ci) => selectedSet.has(ci.cartItemId))
    : cart.items;
  const unselectedItems = selectedSet
    ? cart.items.filter((ci) => !selectedSet.has(ci.cartItemId))
    : [];
  if (selectedItems.length === 0) {
    return NextResponse.json({ error: "EmptyCart", message: "No items selected for checkout." }, { status: 400 });
  }

  let resolvedCoupon: Awaited<ReturnType<typeof prisma.coupon.findFirst>> | null = null;
  if (couponCode) {
    resolvedCoupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode, isActive: true,
        startDate: { lte: new Date() }, endDate: { gte: new Date() },
      },
    });
  }

  // Pre-compute each selected line's unit price and the subtotal scoped to
  // the coupon's store so the discount only applies to matching products.
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
      couponDiscount = couponEligibleSubtotal.mul(resolvedCoupon.discountValue).div(100);
    } else {
      couponDiscount = new Prisma.Decimal(resolvedCoupon.discountValue);
    }
    if (couponDiscount.gt(couponEligibleSubtotal)) couponDiscount = couponEligibleSubtotal;
  }
  const total = subtotal.sub(couponDiscount);

  const result = await prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: { transactionType: "purchase", userId: r.auth.uid, totalAmount: total },
    });
    const order = await tx.order.create({
      data: {
        cartId: cart.cartId,
        totalPrice: total,
        status: "paid",
        transactionId: txn.transactionId,
        items: {
          create: selectedItems.map((ci) => ({
            productItemId: ci.productItemId,
            quantity: ci.quantity,
            priceAtPurchase: unitPrice(ci),
            // Stamp the coupon only on lines from the coupon's store so the
            // order receipt shows which lines were actually discounted.
            couponId:
              resolvedCoupon && ci.productItem.product.storeId === resolvedCoupon.storeId
                ? resolvedCoupon.couponId
                : null,
          })),
        },
      },
    });
    await tx.cart.update({ where: { cartId: cart.cartId }, data: { status: "checked_out" } });
    const newCart = await tx.cart.create({ data: { userId: r.auth.uid, status: "active" } });
    // Re-parent unchecked cart items into the new active cart so they
    // survive the checkout. The unique (cartId, productItemId) holds.
    if (unselectedItems.length > 0) {
      await tx.cartItem.updateMany({
        where: { cartItemId: { in: unselectedItems.map((ci) => ci.cartItemId) } },
        data: { cartId: newCart.cartId },
      });
    }
    if (resolvedCoupon) {
      await tx.couponUsage.create({ data: { couponId: resolvedCoupon.couponId, userId: r.auth.uid } });
    }
    return { order, txn };
  });

  return NextResponse.json({
    orderId: result.order.orderId,
    transactionId: result.txn.transactionId,
    total: Number(total),
    subtotal: Number(subtotal),
    discount: Number(couponDiscount),
    couponStoreId: resolvedCoupon ? resolvedCoupon.storeId : null,
  });
}

export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const orders = await prisma.order.findMany({
    where: { cart: { userId: r.auth.uid } },
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
  return NextResponse.json(orders);
}
