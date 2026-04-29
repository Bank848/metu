import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import type { Request } from "express";
import type {
  AdminGrantInput,
  RequestTopupInput,
  RequestTopupResponse,
  SubmitSlipInput,
  SubmitSlipResponse,
  TopupRow,
  WalletBalanceResponse,
  WalletTxListResponse,
  WalletTxRow,
} from "../models/wallet.model.js";
import { getSettings } from "./settings.service.js";
import { buildTopupQrPayload, verifySlip } from "../utils/promptpay.js";

/** Phase 17.3 — coin/baht ratio. 1 baht = 10 coins. */
const COINS_PER_BAHT = 10;
/** Phase 17.3 — top-up requests expire after 15 minutes if no slip submitted. */
const TOPUP_EXPIRY_MS = 15 * 60 * 1000;

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

// ─────────────────────────────────────────────────────────────────
// Phase 17.3 — top-up flow
// ─────────────────────────────────────────────────────────────────

/**
 * Create a fresh top-up request. Generates a real PromptPay QR for
 * the configured demo PromptPay ID + the requested amount. The QR
 * payload is stored on the topup row so we can render it again on
 * a revisit (e.g. user navigates away then comes back).
 *
 * Returns the QR payload string — the UI generates the QR image
 * client-side via a JS QR encoder library so there's no server
 * round-trip per re-render.
 */
export async function requestTopup(
  uid: number,
  input: RequestTopupInput,
): Promise<RequestTopupResponse> {
  const settings = await getSettings();
  const promptpayId = settings.promptpayId;
  const promptpayPayload = buildTopupQrPayload({
    promptpayId,
    amountBaht: input.amountBaht,
  });
  const coinsExpected = input.amountBaht * COINS_PER_BAHT;
  const row = await prisma.topup.create({
    data: {
      userId: uid,
      amountBaht: input.amountBaht,
      coinsExpected,
      status: "pending",
      promptpayPayload,
    },
  });
  return {
    topupId: row.topupId,
    amountBaht: row.amountBaht,
    coinsExpected: row.coinsExpected,
    promptpayPayload: row.promptpayPayload,
    promptpayId,
    expiresAt: new Date(row.createdAt.getTime() + TOPUP_EXPIRY_MS),
  };
}

/**
 * Submit a payment slip image for a pending top-up. The flow:
 *
 *   1. Look up the topup; reject if missing, not owned by uid, or
 *      not in `pending` status (prevents replay on a paid topup).
 *   2. Reject if the topup has expired (15 min from creation).
 *   3. Run `verifySlip()` against the uploaded image. The util
 *      decodes the image, reads its QR via jsqr, parses the EMVCo
 *      payload, and matches recipient + amount against expected.
 *   4. On verifySlip OK:
 *        a. Try to write `slipReference` (UNIQUE) — INSERT collision
 *           means the SAME slip was already submitted (by anyone),
 *           so we reject as a duplicate.
 *        b. Auto-credit the user's wallet via creditTx + flip
 *           topup status → "paid". All inside one transaction.
 *   5. On verifySlip not OK:
 *        a. Stash the slip image so admin can review manually.
 *        b. Leave status as "pending" — admin reviews via /admin/topups.
 */
export async function submitSlip(
  uid: number,
  topupId: number,
  input: SubmitSlipInput,
  req?: Request,
): Promise<SubmitSlipResponse> {
  const topup = await prisma.topup.findUnique({ where: { topupId } });
  if (!topup || topup.userId !== uid) throw new AppError(404, "TopupNotFound");
  if (topup.status !== "pending") {
    throw new AppError(400, "TopupNotPending", `Top-up is already ${topup.status}.`);
  }
  if (topup.createdAt.getTime() + TOPUP_EXPIRY_MS < Date.now()) {
    await prisma.topup.update({
      where: { topupId },
      data: { status: "expired" },
    });
    throw new AppError(400, "TopupExpired", "This top-up request has expired. Start a new one.");
  }

  const settings = await getSettings();
  const verification = verifySlip(input.slipImage, {
    promptpayId: settings.promptpayId,
    amountBaht: topup.amountBaht,
  });

  if (!verification.ok) {
    // Stash the slip image so admin can manually review. Status
    // stays `pending`. The user is told the auto-verify failed +
    // admin will look at it; no immediate credit.
    await prisma.topup.update({
      where: { topupId },
      data: {
        slipImage: input.slipImage,
        slipQrPayload: verification.qrPayload ?? null,
      },
    });
    return {
      topupId,
      status: "pending",
      autoApproved: false,
      rejectionReason: verification.detail ?? verification.reason,
    };
  }

  // Slip verified — atomic credit + status flip + dedupe via the
  // UNIQUE constraint on slip_reference. If another user (or the
  // same user) already submitted this exact slip, the INSERT fails
  // with a P2002 unique violation; we catch + return a clear error.
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.topup.update({
        where: { topupId },
        data: {
          status: "paid",
          slipImage: input.slipImage,
          slipReference: verification.reference,
          slipQrPayload: verification.qrPayload,
        },
      });
      const credit = await creditTx(
        tx,
        uid,
        topup.coinsExpected,
        "topup",
        `topup:${topupId}`,
        {
          amountBaht: topup.amountBaht,
          slipReference: verification.reference,
        },
      );
      return credit;
    });
    await audit({
      actorId: uid,
      action: "wallet.topup.auto_approved",
      targetType: "topup",
      targetId: topupId,
      meta: {
        amountBaht: topup.amountBaht,
        coinsCredited: topup.coinsExpected,
        slipReference: verification.reference,
        balanceAfter: result.balanceAfter,
      },
      req,
    });
    return {
      topupId,
      status: "paid",
      autoApproved: true,
      balanceAfter: result.balanceAfter,
    };
  } catch (e: unknown) {
    // Prisma P2002 = unique constraint violation. Almost certainly
    // the slipReference UNIQUE — same slip already used.
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      throw new AppError(
        400,
        "DuplicateSlip",
        "This slip has already been used for another top-up. Each slip can only be used once.",
      );
    }
    throw e;
  }
}

/**
 * GET /admin/topups — list pending top-ups for review. Only returns
 * the pending ones by default; an admin can pass ?status=all to see
 * everything (handy for audit).
 */
export async function listTopupsForAdmin(
  status: "pending" | "all" = "pending",
  limit = 100,
): Promise<TopupRow[]> {
  const where = status === "all" ? {} : { status: "pending" as const };
  const rows = await prisma.topup.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
    include: {
      user: { select: { userId: true, username: true, email: true } },
    },
  });
  return rows.map((t) => ({
    topupId: t.topupId,
    amountBaht: t.amountBaht,
    coinsExpected: t.coinsExpected,
    status: t.status,
    user: t.user,
    slipImage: t.slipImage,
    rejectionReason: t.rejectionReason,
    reviewedAt: t.reviewedAt,
    createdAt: t.createdAt,
  }));
}

/** POST /admin/topups/:id/approve — manual override for slips that
 *  failed auto-verify but the admin can confirm out-of-band. */
export async function approveTopup(
  adminUserId: number,
  topupId: number,
  req?: Request,
): Promise<{ balanceAfter: number }> {
  const topup = await prisma.topup.findUnique({ where: { topupId } });
  if (!topup) throw new AppError(404, "TopupNotFound");
  if (topup.status !== "pending") {
    throw new AppError(400, "TopupNotPending");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.topup.update({
      where: { topupId },
      data: {
        status: "paid",
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });
    return creditTx(tx, topup.userId, topup.coinsExpected, "topup", `topup:${topupId}`, {
      amountBaht: topup.amountBaht,
      manuallyApproved: true,
      adminUserId,
    });
  });
  await audit({
    actorId: adminUserId,
    action: "admin.wallet.topup_approve",
    targetType: "topup",
    targetId: topupId,
    meta: {
      targetUserId: topup.userId,
      amountBaht: topup.amountBaht,
      coinsCredited: topup.coinsExpected,
      balanceAfter: result.balanceAfter,
    },
    req,
  });
  return result;
}

/** POST /admin/topups/:id/reject — admin marks the top-up rejected
 *  with a reason. No coins credited; user can submit a fresh slip. */
export async function rejectTopup(
  adminUserId: number,
  topupId: number,
  reason: string,
  req?: Request,
): Promise<void> {
  const topup = await prisma.topup.findUnique({ where: { topupId } });
  if (!topup) throw new AppError(404, "TopupNotFound");
  if (topup.status !== "pending") {
    throw new AppError(400, "TopupNotPending");
  }
  await prisma.topup.update({
    where: { topupId },
    data: {
      status: "rejected",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });
  await audit({
    actorId: adminUserId,
    action: "admin.wallet.topup_reject",
    targetType: "topup",
    targetId: topupId,
    meta: { targetUserId: topup.userId, amountBaht: topup.amountBaht, reason },
    req,
  });
}
