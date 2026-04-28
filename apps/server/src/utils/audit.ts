import type { Request } from "express";
import { prisma } from "../db/prisma.js";

/**
 * Append an entry to AuditLog. Fire-and-forget — we never want a
 * logging hiccup to break the destructive action it's recording, so
 * failures are caught + logged to stderr and the caller is never told.
 *
 * Conventions for `action`: dot-separated `<entity>.<verb>` —
 *   - "user.delete"           — admin soft-deleted a user
 *   - "user.ban"              — admin removed for cause + reason
 *   - "user.role_change"      — admin changed a user's role
 *   - "user.set_password"     — Google-only user set their first password
 *   - "user.phone_verified"   — buyer verified their phone via OTP
 *   - "user.sessions_revoked" — user signed out of one or more sessions
 *   - "store.delete"          — admin or seller soft-deleted a store
 *   - "product.delete"        — seller soft-deleted a product
 *   - "order.refund"          — admin or seller refunded an order
 *   - "auth.password_reset"   — a user used a reset token
 *
 * Phase 15.4 — `req` argument captures the request's IP + UA into
 * the audit row. Optional because system actions (cron jobs,
 * one-shot scripts) don't have an HTTP request to read from. Pass
 * the Express `req` from the controller and the helper extracts
 * the bits it cares about.
 */
export async function audit(args: {
  actorId: number | null;
  action: string;
  targetType: string;
  targetId: number;
  meta?: Record<string, unknown> | null;
  /** Optional Express request — when present, ipAddress + userAgent
   *  are captured from the request headers. Pass from controller. */
  req?: Pick<Request, "ip" | "headers"> | null;
}): Promise<void> {
  const ipAddress = args.req?.ip?.slice(0, 45) ?? null;
  // user-agent is typed as string | undefined in Express's
  // IncomingHttpHeaders; on rare HTTP/2 paths it can be string[].
  // Cast to a permissive union and normalise either shape.
  const uaRaw = args.req?.headers?.["user-agent"] as string | string[] | undefined;
  const userAgent =
    typeof uaRaw === "string"
      ? uaRaw.slice(0, 255)
      : Array.isArray(uaRaw)
        ? uaRaw.join(", ").slice(0, 255)
        : null;
  try {
    await prisma.auditLog.create({
      data: {
        actorId: args.actorId,
        action: args.action,
        targetType: args.targetType,
        targetId: args.targetId,
        meta: (args.meta ?? undefined) as any,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record entry", err);
  }
}
