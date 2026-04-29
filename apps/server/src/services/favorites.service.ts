import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { getSettings } from "./settings.service.js";

/**
 * Phase 13.7 — favorites service.
 *
 * The unique (userId, productId) constraint on ProductFavorite makes
 * both add + remove naturally idempotent: re-hearting is a no-op,
 * un-hearting an already-removed row is a silent success.
 *
 * Phase 17.x — every WRITE goes through `ensureFavoritesEnabled()`
 * which throws 403 FavoritesDisabled when admin has turned the
 * feature off via /admin/settings. Reads stay open so a re-enable
 * surfaces existing favourites instantly with no data migration.
 */

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
    // Phase 16.1 — also reject suspended stores so a buyer can't
    // heart something they wouldn't be able to actually browse.
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
