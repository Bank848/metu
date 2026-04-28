import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

/**
 * Phase 13.7 — favorites service.
 *
 * The unique (userId, productId) constraint on ProductFavorite makes
 * both add + remove naturally idempotent: re-hearting is a no-op,
 * un-hearting an already-removed row is a silent success.
 */

export async function listForUser(userId: number): Promise<number[]> {
  const rows = await prisma.productFavorite.findMany({
    where: { userId },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

/**
 * Heart the product. Verifies the product still exists, isn't soft-
 * deleted, and isn't orphaned by a deleted store — same hygiene as
 * the legacy BFF route. Avoids cluttering favourites with ghosts.
 */
export async function addFavorite(userId: number, productId: number): Promise<void> {
  const exists = await prisma.product.findFirst({
    where: { productId, deletedAt: null, store: { deletedAt: null } },
    select: { productId: true },
  });
  if (!exists) throw new AppError(404, "ProductNotFound");

  await prisma.productFavorite.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
}

/** Un-heart. No-op if the row was already gone. */
export async function removeFavorite(userId: number, productId: number): Promise<void> {
  await prisma.productFavorite.deleteMany({
    where: { userId, productId },
  });
}
