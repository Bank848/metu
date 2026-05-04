/**
 * IP-level ban service.
 * Reads/writes the `banned_ip` table + maintains an in-memory cache
 * the middleware reads on every request. The cache is module-scoped
 * (one Map per Node process) with a 60-second TTL — DB sees one row
 * per banned IP per minute under sustained traffic, instead of one
 * lookup per request.
 * Cache invalidation: every write (`addBan` / `removeBan` /
 * `banUserSessions`) calls `invalidateCache(ip)` so the next request
 * from that IP re-reads from the DB. The middleware imports the
 * cache directly so we don't have to plumb it through service args.
 */
import { isIP } from "node:net";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import type { Request } from "express";

type AuditReq = Pick<Request, "ip" | "headers"> | null | undefined;

// audit (CRITICAL #2) — original cache TTL was
// 60s. With ≥2 Fly machines per app the cache is incoherent across
// hosts: an addBan invalidates only on the machine that handled the
// POST. Shorter TTL bounds the staleness window. We keep some
// caching so the hot path doesn't query Postgres on every request.
const CACHE_TTL_MS = 10_000;

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
  const expiresAtMs = hit?.expiresAt?.getTime() ?? null;
  const banned = Boolean(hit && (!expiresAtMs || expiresAtMs > now));
  // if a row is present but expiring soon,
  // cap the cache TTL so the *next* request sees the row gone instead
  // of waiting another 10s. Same on the negative side — if the row
  // *will* be banned again at some known future time we don't model
  // it (re-ban is rare), but expiry is the common path.
  let ttl = CACHE_TTL_MS;
  if (banned && expiresAtMs) {
    ttl = Math.max(0, Math.min(CACHE_TTL_MS, expiresAtMs - now));
  }
  cache.set(ip, { banned, until: now + ttl });
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
  // proper IPv4/IPv6 validation via
  // node:net.isIP. Length-only check let "192.168.1.1; DROP TABLE"
  // through and polluted the audit feed with un-matchable entries
  // (it's not SQL-injectable thanks to Prisma parametrisation, but
  // still confusing).
  if (isIP(ip) === 0) {
    throw new AppError(400, "InvalidIp", "Not a valid IPv4 or IPv6 address.");
  }
  // refuse to ban the actor's own
  // current IP. Without this guard a single click can lock every
  // admin behind the same NAT out of the unban surface itself.
  if (req?.ip && req.ip.trim() === ip) {
    throw new AppError(
      400,
      "CannotBanSelfIp",
      "You're currently using this IP. Banning it would lock you out of the unban surface.",
    );
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
): Promise<{ ipAddresses: string[]; bannedCount: number; skippedSelfIp: string[] }> {
  const sessions = await prisma.session.findMany({
    where: { userId: targetUserId, ipAddress: { not: null } },
    select: { ipAddress: true },
    distinct: ["ipAddress"],
  });
  const actorIp = req?.ip?.trim() ?? "";
  const skippedSelfIp: string[] = [];
  const ips = sessions
    .map((s) => s.ipAddress?.trim())
    .filter((ip): ip is string => Boolean(ip && ip.length > 0))
    // even the bulk action must skip
    // the actor's current egress IP so they don't lock themselves
    // out. The session list often includes shared NAT addresses.
    .filter((ip) => {
      if (actorIp && ip === actorIp) {
        skippedSelfIp.push(ip);
        return false;
      }
      return true;
    })
    // drop garbage IPs that somehow
    // ended up in better-auth's Session table. We don't want to
    // pollute banned_ip with unmatchable rows.
    .filter((ip) => isIP(ip) !== 0);

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
    meta: { ipAddresses: ips, bannedCount, reason, skippedSelfIp },
    req,
  });

  return { ipAddresses: ips, bannedCount, skippedSelfIp };
}
