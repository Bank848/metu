import { prisma } from "../db/prisma.js";
import { audit } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";
import type { PublicSettings, SettingsPatch } from "../models/settings.model.js";

/**
 * Phase 17.1 / 26 — system settings service (slimmed down).
 *
 * The settings row is single-row by SQL CHECK constraint (id=1).
 * Reads are cached in-memory for 30 s so every request to /browse
 * doesn't pay a round-trip just to check the favouritesEnabled flag.
 *
 * Writes go through `updateSettings(actor, patch)` which:
 *   1. Patches the row.
 *   2. Invalidates the cache.
 *   3. Writes a structured AuditLog row capturing the diff.
 *
 * Phase 26 dropped walletEnabled, chatEnabled, promptpayId, and
 * withdrawalFeePercent from the row (PromptPay/coin layer removed —
 * Stripe Connect takes over in Phase 27).
 */

interface CachedSettings {
  value: PublicSettings;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
let cache: CachedSettings | null = null;

function bustCache() {
  cache = null;
}

export async function getSettings(): Promise<PublicSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  let row = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.systemSetting.create({ data: { id: 1 } });
  }
  // googleEnabled is derived from the env at request time so we don't
  // have to re-cache the settings row when secrets get rotated.
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  const value: PublicSettings = {
    favoritesEnabled: row.favoritesEnabled,
    platformFeePercent: Number(row.platformFeePercent),
    updatedAt: row.updatedAt,
    googleEnabled,
  };
  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
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
  if (patch.platformFeePercent !== undefined) data.platformFeePercent = patch.platformFeePercent;

  const row = await prisma.systemSetting.update({ where: { id: 1 }, data });
  bustCache();

  // Build a diff for the audit row — only include fields that
  // actually changed value.
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
    platformFeePercent: Number(row.platformFeePercent),
    updatedAt: row.updatedAt,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
  };
}
