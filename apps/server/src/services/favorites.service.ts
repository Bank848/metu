import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { getSettings } from "./settings.service.js";

// Favorites service. Unique (userId, productId) makes add+remove
// naturally idempotent. Writes gate on the favoritesEnabled setting.

async function ensureFavoritesEnabled() {
  const settings = await getSettings();
  if (!settings.favoritesEnabled) {
    throw new AppError(403, "FavoritesDisabled", "The favorites feature is currently disabled.");
  }
}

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
  await ensureFavoritesEnabled();
  const exists = await prisma.product.findFirst({
    // Reject suspended stores too.
    where: { productId, deletedAt: null, store: { deletedAt: null, suspendedAt: null } },
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
  await ensureFavoritesEnabled();
  await prisma.productFavorite.deleteMany({
    where: { userId, productId },
  });
}
