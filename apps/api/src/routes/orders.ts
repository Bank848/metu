import { Router } from "express";
import { Prisma } from "@prisma/client";
import { checkoutSchema } from "@metu/shared";
import { prisma } from "../lib/prisma.js";
import { currentAuth, requireAuth } from "../lib/auth.js";

export const ordersRouter = Router();

// Checkout: atomically convert active cart → order + transaction.
ordersRouter.post("/", requireAuth(), async (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError" });
      return;
    }
    const auth = currentAuth(req)!;
    const { couponCode } = parsed.data;

    const cart = await prisma.cart.findFirst({
      where: { userId: auth.uid, status: "active" },
      include: {
        items: {
          include: { productItem: { include: { product: true } } },
        },
      },
    });
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ error: "EmptyCart" });
      return;
    }

    let resolvedCoupon: Awaited<ReturnType<typeof prisma.coupon.findFirst>> | null = null;
    if (couponCode) {
      resolvedCoupon = await prisma.coupon.findFirst({
        where: { code: couponCode, isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      });
    }

    // Compute totals
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
      // 1. Transaction (payment)
      const txn = await tx.transaction.create({
        data: {
          transactionType: "purchase",
          userId: auth.uid,
          totalAmount: total,
        },
      });

      // 2. Order + order items
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

      // 3. Flip cart → checked_out, create new empty active cart
      await tx.cart.update({
        where: { cartId: cart.cartId },
        data: { status: "checked_out" },
      });
      await tx.cart.create({ data: { userId: auth.uid, status: "active" } });

      // 4. Coupon usage
      if (resolvedCoupon) {
        await tx.couponUsage.create({
          data: { couponId: resolvedCoupon.couponId, userId: auth.uid },
        });
      }

      return { order, txn };
    });

    res.json({
      orderId: result.order.orderId,
      transactionId: result.txn.transactionId,
      total: Number(total),
      subtotal: Number(subtotal),
      discount: Number(couponDiscount),
    });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/", requireAuth(), async (req, res, next) => {
  try {
    const auth = currentAuth(req)!;
    const orders = await prisma.order.findMany({
      where: { cart: { userId: auth.uid } },
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
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const auth = currentAuth(req)!;
    const order = await prisma.order.findFirst({
      where: { orderId: id, cart: { userId: auth.uid } },
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
            coupon: true,
          },
        },
        transaction: true,
      },
    });
    if (!order) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});
