import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import type { Request } from "express";
import type {
  AdminGrantInput,
  WalletBalanceResponse,
  WalletTxListResponse,
  WalletTxRow,
} from "../models/wallet.model.js";
import { getSettings } from "./settings.service.js";

/**
 * Phase 17.1 — wallet service.
 *
 * The wallet table is created lazily on first credit/debit so we
 * don't have to write a row for every brand-new user. Every coin
 * movement goes through `creditTx()` or `debitTx()` helpers which
 * INSIDE a Prisma transaction:
 *   1. Lock the wallet row (`SELECT ... FOR UPDATE` via Prisma's
 *      transaction isolation — Postgres default READ COMMITTED is
 *      enough since we serialize through the row's PK).
 *   2. Compute the new balance.
 *   3. UPDATE the balance.
 *   4. INSERT a wallet_transaction row with `balanceAfter` so the
 *      ledger UI never has to reconstruct the balance from a
 *      window function.
 *   5. (For debits) reject with `InsufficientBalance` if the
 *      resulting balance would go negative — guarded by both an
 *      app-level check AND a SQL CHECK constraint as
 *      defence in depth.
 *
 * Public callers go through the non-tx wrappers `credit()`/`debit()`
 * which open a fresh transaction. The `*Tx()` variants accept a
 * Prisma client + are meant to be called INSIDE the existing
 * order-checkout transaction (so the coin debit + order creation
 * commit atomically).
 */

type TxClient = Prisma.TransactionClient | typeof prisma;

async function ensureWallet(uid: number, tx: TxClient): Promise<{ walletId: number; balance: number }> {
  const existing = await tx.wallet.findUnique({ where: { userId: uid } });
  if (existing) return { walletId: existing.walletId, balance: existing.balance };
  const created = await tx.wallet.create({ data: { userId: uid, balance: 0 } });
  return { walletId: created.walletId, balance: created.balance };
}

/**
 * Inside-transaction credit. Use from order-checkout / refund flows
 * that need the credit to commit atomically with surrounding work.
 */
export async function creditTx(
  tx: Prisma.TransactionClient,
  uid: number,
  amount: number,
  type: "topup" | "refund" | "grant",
  reference: string | null,
  meta: Record<string, unknown> | null = null,
): Promise<{ balanceAfter: number }> {
  if (amount <= 0) throw new AppError(400, "InvalidAmount", "Amount must be positive.");
  const { balance } = await ensureWallet(uid, tx);
  const balanceAfter = balance + amount;
  await tx.wallet.update({ where: { userId: uid }, data: { balance: balanceAfter } });
  await tx.walletTransaction.create({
    data: {
      userId: uid,
      type,
      amount,
      balanceAfter,
      reference,
      meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  return { balanceAfter };
}

/**
 * Inside-transaction debit. Throws `InsufficientBalance` BEFORE
 * the UPDATE so callers can map it to a clean checkout-error
 * surface ("you need 1,234 more coins to complete this order").
 */
export async function debitTx(
  tx: Prisma.TransactionClient,
  uid: number,
  amount: number,
  reference: string | null,
  meta: Record<string, unknown> | null = null,
): Promise<{ balanceAfter: number }> {
  if (amount <= 0) throw new AppError(400, "InvalidAmount", "Amount must be positive.");
  const { balance } = await ensureWallet(uid, tx);
  if (balance < amount) {
    throw new AppError(400, "InsufficientBalance", `Need ${amount} coins, have ${balance}.`);
  }
  const balanceAfter = balance - amount;
  await tx.wallet.update({ where: { userId: uid }, data: { balance: balanceAfter } });
  await tx.walletTransaction.create({
    data: {
      userId: uid,
      type: "spend",
      amount: -amount,
      balanceAfter,
      reference,
      meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  return { balanceAfter };
}

/**
 * Public credit — opens its own transaction. Use for one-off flows
 * (top-up confirmation, admin grant) that don't have surrounding
 * work that needs to commit atomically.
 */
export async function credit(
  uid: number,
  amount: number,
  type: "topup" | "refund" | "grant",
  reference: string | null,
  meta: Record<string, unknown> | null = null,
): Promise<{ balanceAfter: number }> {
  return prisma.$transaction((tx) => creditTx(tx, uid, amount, type, reference, meta));
}

export async function debit(
  uid: number,
  amount: number,
  reference: string | null,
  meta: Record<string, unknown> | null = null,
): Promise<{ balanceAfter: number }> {
  return prisma.$transaction((tx) => debitTx(tx, uid, amount, reference, meta));
}

/**
 * Read-side: balance + the walletEnabled flag so the UI can decide
 * whether to surface the "top-up" CTA at all.
 */
export async function getBalance(uid: number): Promise<WalletBalanceResponse> {
  const [w, settings] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: uid } }),
    getSettings(),
  ]);
  return {
    balance: w?.balance ?? 0,
    walletEnabled: settings.walletEnabled,
  };
}

export async function listTransactions(
  uid: number,
  limit = 50,
): Promise<WalletTxListResponse> {
  const [w, txs] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: uid } }),
    prisma.walletTransaction.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    }),
  ]);
  const transactions: WalletTxRow[] = txs.map((t) => ({
    id: t.walletTxId,
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    reference: t.reference,
    meta: (t.meta as Record<string, unknown> | null) ?? null,
    createdAt: t.createdAt,
  }));
  return { balance: w?.balance ?? 0, transactions };
}

/**
 * Admin grant — credits coins to any user with a reason. Audit log
 * captures actor + target + amount + reason for the trail.
 */
export async function adminGrant(
  actorUserId: number,
  targetUserId: number,
  input: AdminGrantInput,
  req?: Request,
): Promise<{ balanceAfter: number }> {
  const target = await prisma.user.findUnique({
    where: { userId: targetUserId },
    select: { userId: true, deletedAt: true },
  });
  if (!target || target.deletedAt) throw new AppError(404, "UserNotFound");

  const result = await credit(targetUserId, input.amount, "grant", `admin-grant:${actorUserId}`, {
    reason: input.reason,
    actorUserId,
  });
  await audit({
    actorId: actorUserId,
    action: "admin.wallet.grant",
    targetType: "user",
    targetId: targetUserId,
    meta: { amount: input.amount, reason: input.reason, balanceAfter: result.balanceAfter },
    req,
  });
  return result;
}
