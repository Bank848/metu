import type { Request } from "express";
import { prisma } from "../db/prisma.js";
import { clientIp } from "./client-ip.js";

/**
 * Append an entry to AuditLog. Fire-and-forget; logging failures
 * never break the action being recorded. Action convention:
 * "<entity>.<verb>" (e.g. "user.delete", "order.refund").
 * Pass `req` to capture IP + user-agent.
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
  const ipAddress = clientIp(args.req);
  // user-agent can be string[] on HTTP/2 paths.
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
