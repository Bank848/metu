import { prisma } from "../db/prisma.js";
import { audit } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";
import type { PublicSettings, SettingsPatch } from "../models/settings.model.js";

// Single-row settings (CHECK id=1). No in-memory cache so admin
// flag flips are visible on the very next read on every Fly machine
// — the previous 30 s cache made cross-machine propagation feel
// inconsistent (the PATCH'd machine bust its slot, the other did
// not until natural TTL). The underlying SELECT is one row by PK
// over pgbouncer; cost is sub-10 ms.

export async function getSettings(): Promise<PublicSettings> {
  let row = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.systemSetting.create({ data: { id: 1 } });
  }
  // Derived at request time so secret rotations don't need a cache bust.
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  return {
    favoritesEnabled: row.favoritesEnabled,
    giftingEnabled: row.giftingEnabled,
    platformFeePercent: Number(row.platformFeePercent),
    updatedAt: row.updatedAt,
    googleEnabled,
  };
}

export async function updateSettings(
  actorUserId: number,
  patch: SettingsPatch,
  req?: import("express").Request,
): Promise<PublicSettings> {
  if (Object.keys(patch).length === 0) {
    throw new AppError(400, "EmptyPatch", "Provide at least one field to update.");
  }
  const before = await getSettings();
  const data: Record<string, unknown> = {};
  if (patch.favoritesEnabled !== undefined) data.favoritesEnabled = patch.favoritesEnabled;
  if (patch.giftingEnabled !== undefined) data.giftingEnabled = patch.giftingEnabled;
  if (patch.platformFeePercent !== undefined) data.platformFeePercent = patch.platformFeePercent;

  const row = await prisma.systemSetting.update({ where: { id: 1 }, data });

  // Diff only the fields that actually changed.
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data)) {
    const beforeVal = (before as unknown as Record<string, unknown>)[k];
    const afterVal = (row as unknown as Record<string, unknown>)[k];
    if (beforeVal !== afterVal) diff[k] = { from: beforeVal, to: afterVal };
  }
  if (Object.keys(diff).length > 0) {
    await audit({
      actorId: actorUserId,
      action: "system.settings.update",
      targetType: "system_setting",
      targetId: 1,
      meta: diff,
      req,
    });
  }

  return {
    favoritesEnabled: row.favoritesEnabled,
    giftingEnabled: row.giftingEnabled,
    platformFeePercent: Number(row.platformFeePercent),
    updatedAt: row.updatedAt,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
  };
}
