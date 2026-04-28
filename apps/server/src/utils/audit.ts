import { prisma } from "../db/prisma.js";

/**
 * Append an entry to AuditLog. Fire-and-forget — we never want a
 * logging hiccup to break the destructive action it's recording, so
 * failures are caught + logged to stderr and the caller is never told.
 *
 * Conventions for `action`: dot-separated `<entity>.<verb>` —
 *   - "user.delete"          — admin soft-deleted a user
 *   - "user.ban"             — admin removed for cause + reason
 *   - "user.role_change"     — admin changed a user's role
 *   - "store.delete"         — admin or seller soft-deleted a store
 *   - "product.delete"       — seller soft-deleted a product
 *   - "order.refund"         — admin or seller refunded an order
 *   - "auth.password_reset"  — a user used a reset token
 */
export async function audit(args: {
  actorId: number | null;
  action: string;
  targetType: string;
  targetId: number;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: args.actorId,
        action: args.action,
        targetType: args.targetType,
        targetId: args.targetId,
        meta: (args.meta ?? undefined) as any,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record entry", err);
  }
}
