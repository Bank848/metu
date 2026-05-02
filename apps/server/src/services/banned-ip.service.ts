/**
 * Phase 48 — IP-level ban service.
 *
 * Reads/writes the `banned_ip` table + maintains an in-memory cache
 * the middleware reads on every request. The cache is module-scoped
 * (one Map per Node process) with a 60-second TTL — DB sees one row
 * per banned IP per minute under sustained traffic, instead of one
 * lookup per request.
 *
 * Cache invalidation: every write (`addBan` / `removeBan` /
 * `banUserSessions`) calls `invalidateCache(ip)` so the next request
 * from that IP re-reads from the DB. The middleware imports the
 * cache directly so we don't have to plumb it through service args.
 */
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import type { Request } from "express";

type AuditReq = Pick<Request, "ip" | "headers"> | null | undefined;

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  banned: boolean;
  until: number; // epoch ms when this entry expires
}

const cache = new Map<string, CacheEntry>();

/**
 * Cheap in-memory check used by the ipBanCheck middleware. Falls
 * through to the DB when the cache is cold or the TTL has expired.
 */
export async function isIpBanned(ip: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(ip);
  if (cached && cached.until > now) return cached.banned;

  const hit = await prisma.bannedIp.findUnique({
    where: { ipAddress: ip },
    select: { expiresAt: true },
  });
  const banned = Boolean(
    hit && (!hit.expiresAt || hit.expiresAt > new Date()),
  );
  cache.set(ip, { banned, until: now + CACHE_TTL_MS });
  return banned;
}

export function invalidateCache(ip: string) {
  cache.delete(ip);
}

export async function listBans() {
  const rows = await prisma.bannedIp.findMany({
    orderBy: { bannedAt: "desc" },
    include: {
      bannedBy: {
        select: { userId: true, username: true, firstName: true, lastName: true },
      },
    },
  });
  return rows;
}

export interface AddBanInput {
  ipAddress: string;
  reason?: string | null;
  /** ISO string from the admin form; `null` / undefined = forever. */
  expiresAt?: string | Date | null;
}

export async function addBan(
  input: AddBanInput,
  actorUserId: number,
  req?: AuditReq,
) {
  const ip = input.ipAddress.trim();
  if (!ip) throw new AppError(400, "MissingIp", "ipAddress is required.");
  // Loose validation — IPv4 + IPv6 share too many edge cases for a
  // tight regex. The middleware just compares strings, so any value
  // the operator types in will be matched literally.
  if (ip.length > 45) {
    throw new AppError(400, "InvalidIp", "IP address must be 45 characters or fewer.");
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "InvalidExpiresAt", "Couldn't parse expiresAt as a date.");
  }

  // Upsert so the operator can re-ban an existing IP (update reason
  // + expiry) without a separate delete.
  const row = await prisma.bannedIp.upsert({
    where: { ipAddress: ip },
    create: {
      ipAddress: ip,
      reason: input.reason?.trim() ? input.reason.trim().slice(0, 255) : null,
      bannedById: actorUserId,
      expiresAt,
    },
    update: {
      reason: input.reason?.trim() ? input.reason.trim().slice(0, 255) : null,
      bannedById: actorUserId,
      expiresAt,
      bannedAt: new Date(),
    },
  });

  invalidateCache(ip);
  await audit({
    actorId: actorUserId,
    action: "ip.ban",
    targetType: "ip",
    targetId: row.bannedIpId,
    meta: { ipAddress: ip, reason: row.reason, expiresAt },
    req,
  });
  return row;
}

export async function removeBan(
  bannedIpId: number,
  actorUserId: number,
  req?: AuditReq,
) {
  const row = await prisma.bannedIp.findUnique({
    where: { bannedIpId },
    select: { ipAddress: true },
  });
  if (!row) throw new AppError(404, "NotFound");
  await prisma.bannedIp.delete({ where: { bannedIpId } });
  invalidateCache(row.ipAddress);
  await audit({
    actorId: actorUserId,
    action: "ip.unban",
    targetType: "ip",
    targetId: bannedIpId,
    meta: { ipAddress: row.ipAddress },
    req,
  });
}

/**
 * Quick action invoked from /admin/users — pulls every distinct IP
 * from a user's Session rows and bans them all in one go. Useful
 * when a single account has been spamming from multiple addresses.
 */
export async function banUserSessions(
  targetUserId: number,
  actorUserId: number,
  reason: string | null,
  req?: AuditReq,
): Promise<{ ipAddresses: string[]; bannedCount: number }> {
  const sessions = await prisma.session.findMany({
    where: { userId: targetUserId, ipAddress: { not: null } },
    select: { ipAddress: true },
    distinct: ["ipAddress"],
  });
  const ips = sessions
    .map((s) => s.ipAddress?.trim())
    .filter((ip): ip is string => Boolean(ip && ip.length > 0));

  let bannedCount = 0;
  for (const ip of ips) {
    await prisma.bannedIp.upsert({
      where: { ipAddress: ip },
      create: {
        ipAddress: ip,
        reason: reason?.trim() ? reason.trim().slice(0, 255) : null,
        bannedById: actorUserId,
      },
      update: {
        reason: reason?.trim() ? reason.trim().slice(0, 255) : null,
        bannedById: actorUserId,
        bannedAt: new Date(),
      },
    });
    invalidateCache(ip);
    bannedCount++;
  }

  await audit({
    actorId: actorUserId,
    action: "ip.ban_user_sessions",
    targetType: "user",
    targetId: targetUserId,
    meta: { ipAddresses: ips, bannedCount, reason },
    req,
  });

  return { ipAddresses: ips, bannedCount };
}
