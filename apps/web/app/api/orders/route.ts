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
  const { couponCode } = parsed.data;

  const cart = await prisma.cart.findFirst({
    where: { userId: r.auth.uid, status: "active" },
    include: { items: { include: { productItem: { include: { product: true } } } } },
  });
  if (!cart || cart.items.length === 0) return NextResponse.json({ error: "EmptyCart" }, { status: 400 });

  let resolvedCoupon: Awaited<ReturnType<typeof prisma.coupon.findFirst>> | null = null;
  if (couponCode) {
    resolvedCoupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode, isActive: true,
        startDate: { lte: new Date() }, endDate: { gte: new Date() },
      },
    });
  }

  let subtotal = new Prisma.Decimal(0);
  for (const ci of cart.items) {
    const unit = new Prisma.Decimal(ci.productItem.price).mul(
      new Prisma.Decimal(100 - (ci.productItem.discountPercent ?? 0)).div(100),
    );
    subtotal = subtotal.add(unit.mul(ci.quantity));
  }
  let couponDiscount = new Prisma.Decimal(0);
  if (resolvedCoupon) {
    if (resolvedCoupon.discountType === "percent") {
      couponDiscount = subtotal.mul(resolvedCoupon.discountValue).div(100);
    } else {
      couponDiscount = new Prisma.Decimal(resolvedCoupon.discountValue);
    }
    if (couponDiscount.gt(subtotal)) couponDiscount = subtotal;
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
          create: cart.items.map((ci) => ({
            productItemId: ci.productItemId,
            quantity: ci.quantity,
            priceAtPurchase: new Prisma.Decimal(ci.productItem.price).mul(
              new Prisma.Decimal(100 - (ci.productItem.discountPercent ?? 0)).div(100),
            ),
            couponId: resolvedCoupon ? resolvedCoupon.couponId : null,
          })),
        },
      },
    });
    await tx.cart.update({ where: { cartId: cart.cartId }, data: { status: "checked_out" } });
    await tx.cart.create({ data: { userId: r.auth.uid, status: "active" } });
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
