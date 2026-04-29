import { prisma } from "../db/prisma.js";
import { audit } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";
import type { PublicSettings, SettingsPatch } from "../models/settings.model.js";

/**
 * Phase 17.1 — system settings service.
 *
 * The settings row is single-row by SQL CHECK constraint (id=1).
 * Reads are cached in-memory for 30 s so every request to /browse,
 * /messages, /admin/* doesn't pay a round-trip just to check the
 * walletEnabled / chatEnabled flags.
 *
 * Writes go through `updateSettings(actor, patch)` which:
 *   1. Patches the row.
 *   2. Invalidates the cache.
 *   3. Writes a structured AuditLog row capturing the diff —
 *      every flag flip leaves a trail so admins can later see who
 *      turned wallet on/off and when.
 *
 * The cache is process-local. Since we run two Fly machines, a
 * flip is observed by the OTHER machine within 30 s. That's
 * acceptable for feature flags (no atomic-flip requirement); if
 * we ever need true cross-machine flip we can add a Postgres
 * `LISTEN/NOTIFY` channel, but for the demo the 30-s skew is fine.
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

/**
 * Read the current settings (cached). Reads through cache; on
 * cache miss, hits the DB and refills. Always returns a value —
 * if the row is missing for some reason we lazily insert defaults
 * so a fresh DB without the migration's seed insert still boots.
 */
export async function getSettings(): Promise<PublicSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  let row = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (!row) {
    // Defensive — the migration seeds id=1, but if a future env
    // forgot to run it we still want the server to boot.
    row = await prisma.systemSetting.create({ data: { id: 1 } });
  }
  // googleEnabled is derived from the env at request time so we don't
  // have to re-cache the settings row when secrets get rotated. The
  // check matches the same condition lib/auth.ts uses to decide
  // whether to mount the Google social provider — keeping them in
  // sync means the BFF never advertises a Google button when the
  // backend can't actually accept Google sign-ins.
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  const value: PublicSettings = {
    walletEnabled: row.walletEnabled,
    chatEnabled: row.chatEnabled,
    favoritesEnabled: row.favoritesEnabled,
    promptpayId: row.promptpayId,
    updatedAt: row.updatedAt,
    googleEnabled,
  };
  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/**
 * Admin-only update. Accepts a partial patch; only touches the
 * keys provided. Writes an AuditLog row showing exactly which
 * fields changed (old → new) so the audit trail is searchable.
 */
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
  if (patch.walletEnabled !== undefined) data.walletEnabled = patch.walletEnabled;
  if (patch.chatEnabled !== undefined) data.chatEnabled = patch.chatEnabled;
  if (patch.favoritesEnabled !== undefined) data.favoritesEnabled = patch.favoritesEnabled;
  if (patch.promptpayId !== undefined) data.promptpayId = patch.promptpayId;

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
    walletEnabled: row.walletEnabled,
    chatEnabled: row.chatEnabled,
    favoritesEnabled: row.favoritesEnabled,
    promptpayId: row.promptpayId,
    updatedAt: row.updatedAt,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
  };
}
