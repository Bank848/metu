import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

/**
 * Phase 13.7 — stock alerts service.
 *
 * The unique (userId, productItemId) constraint on StockAlert makes
 * subscribe idempotent. Re-subscribing also clears the previous
 * `notifiedAt` so the buyer gets pinged again next time stock comes
 * back (covers the "I already got notified once but want to re-arm
 * the alert" flow).
 */

export async function subscribe(userId: number, productItemId: number): Promise<void> {
  const exists = await prisma.productItem.findFirst({
    where: {
      productItemId,
      // Phase 16.1 — also reject suspended stores.
      product: { deletedAt: null, store: { deletedAt: null, suspendedAt: null } },
    },
    select: { productItemId: true },
  });
  if (!exists) throw new AppError(404, "VariantNotFound");

  await prisma.stockAlert.upsert({
    where: { userId_productItemId: { userId, productItemId } },
    update: { notifiedAt: null },
    create: { userId, productItemId },
  });
}

export async function unsubscribe(userId: number, productItemId: number): Promise<void> {
  await prisma.stockAlert.deleteMany({
    where: { userId, productItemId },
  });
}
