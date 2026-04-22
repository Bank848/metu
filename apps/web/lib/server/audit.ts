import { prisma } from "./prisma";

/**
 * Append an entry to AuditLog. Fire-and-forget — we never want a logging
 * hiccup to break the destructive action it's recording, so failures are
 * caught + logged to stdout and the caller is never told.
 *
 * Conventions for `action`: dot-separated `<entity>.<verb>` —
 *   - "user.delete"        — admin soft-deleted a user
 *   - "user.role_change"   — admin changed a user's role
 *   - "store.delete"       — admin or seller soft-deleted a store
 *   - "product.delete"     — seller soft-deleted a product
 *   - "order.refund"       — admin or seller refunded an order
 *   - "transaction.delete" — admin removed a transaction record
 *   - "auth.password_reset"— a user used a reset token to change pw
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
        meta: (args.meta as never) ?? undefined,
      },
    });
  } catch (err) {
    // Don't crash the calling request if audit insertion fails — we'd
    // rather lose a log line than block a seller from refunding an order.
    // eslint-disable-next-line no-console
    console.warn(
      `[audit] failed to persist ${args.action} on ${args.targetType}#${args.targetId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
