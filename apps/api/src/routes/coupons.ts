import { Router } from "express";
import { validateCouponSchema } from "@metu/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

export const couponsRouter = Router();

couponsRouter.post("/validate", requireAuth(), async (req, res, next) => {
  try {
    const parsed = validateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ valid: false, reason: "Invalid request" });
      return;
    }
    const { code } = parsed.data;
    const coupon = await prisma.coupon.findFirst({
      where: { code, isActive: true },
      include: { store: { select: { storeId: true, name: true } } },
    });
    if (!coupon) {
      res.json({ valid: false, reason: "Coupon not found or inactive" });
      return;
    }
    const now = new Date();
    if (now < coupon.startDate) {
      res.json({ valid: false, reason: "Coupon is not yet active" });
      return;
    }
    if (now > coupon.endDate) {
      res.json({ valid: false, reason: "Coupon has expired" });
      return;
    }
    const used = await prisma.couponUsage.count({ where: { couponId: coupon.couponId } });
    if (used >= coupon.usageLimit) {
      res.json({ valid: false, reason: "Coupon usage limit reached" });
      return;
    }

    res.json({
      valid: true,
      code: coupon.code,
      couponId: coupon.couponId,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      store: coupon.store,
    });
  } catch (err) {
    next(err);
  }
});
