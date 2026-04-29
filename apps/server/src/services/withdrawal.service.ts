import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import { getSettings } from "./settings.service.js";
import type {
  ApproveWithdrawalInput,
  RejectWithdrawalInput,
  RequestWithdrawalInput,
  SellerWalletResponse,
  WithdrawalRow,
} from "../models/withdrawal.model.js";

/**
 * Phase 20.2 — seller withdrawal service.
 *
 * Lifecycle:
 *   1. Seller calls `requestWithdrawal()` → balance check + deduct
 *      from `Store.coinBalance` + create Withdrawal row + write a
 *      `withdraw` StoreTransaction row, all inside one transaction.
 *      The deduction happens at REQUEST time so two simultaneous
 *      requests can't double-spend the balance — even if one is
 *      later rejected, the deduction is undone via withdraw_reverse.
 *   2. Admin reviews via `/admin/withdrawals` → either:
 *      a. Approve → set status=paid, attach base64 slip image, audit.
 *         Coins were already deducted at step 1, so no balance
 *         movement happens here.
 *      b. Reject → return coins to Store.coinBalance via a
 *         withdraw_reverse StoreTransaction, set status=rejected,
 *         capture the reason, audit.
 *
 * Race-safety: every balance-mutating path runs inside a $transaction.
 * The CHECK constraint at the SQL layer (store_coin_balance_nonnegative)
 * is the last line of defence — Postgres rolls back if a deduct would
 * take the balance below zero, throwing a descriptive AppError.
 */

const COINS_PER_BAHT = 10;

interface WithdrawalRowInternal {
  withdrawalId: number;
  storeId: number;
  store: { name: string };
  amountCoins: number;
  feePercentBp: number;
  feeCoins: number;
  netCoins: number;
  netBaht: Prisma.Decimal;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  status: "pending" | "paid" | "rejected";
  requestedAt: Date;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  paidProofImage: string | null;
  rejectionReason: string | null;
}

function toRow(r: WithdrawalRowInternal): WithdrawalRow {
  return {
    withdrawalId: r.withdrawalId,
    storeId: r.storeId,
    storeName: r.store.name,
    amountCoins: r.amountCoins,
    feePercentBp: r.feePercentBp,
    feeCoins: r.feeCoins,
    netCoins: r.netCoins,
    netBaht: r.netBaht.toString(),
    bankName: r.bankName,
    bankAccountNo: r.bankAccountNo,
    bankAccountName: r.bankAccountName,
    status: r.status,
    requestedAt: r.requestedAt,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    paidProofImage: r.paidProofImage,
    rejectionReason: r.rejectionReason,
  };
}

/**
 * Resolve the calling user's owned Store row. Throws StoreNotFound
 * when the user has no store (shouldn't reach this code path — the
 * `requireStore` middleware should already have gated). Returns
 * minimal fields the service needs (id, deletedAt, suspendedAt,
 * coinBalance, name).
 */
async function getOwnedStore(ownerUserId: number) {
  const store = await prisma.store.findUnique({ where: { ownerId: ownerUserId } });
  if (!store) throw new AppError(404, "StoreNotFound", "You don't have a store.");
  if (store.deletedAt) {
    throw new AppError(403, "StoreDeleted", "Store has been deleted.");
  }
  if (store.suspendedAt) {
    throw new AppError(
      403,
      "StoreSuspended",
      "Store is suspended — contact an admin before requesting a withdrawal.",
    );
  }
  return store;
}

/**
 * Seller view of `/seller/wallet`. Returns the store's current coin
 * balance, the most recent 50 store-transaction rows, and any pending
 * withdrawal requests so the UI can warn the seller "you already have
 * a request in flight".
 */
export async function getSellerWallet(
  ownerUserId: number,
): Promise<SellerWalletResponse> {
  const store = await getOwnedStore(ownerUserId);
  const [recent, pending] = await Promise.all([
    prisma.storeTransaction.findMany({
      where: { storeId: store.storeId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.withdrawal.findMany({
      where: { storeId: store.storeId, status: "pending" },
      orderBy: { requestedAt: "desc" },
      include: { store: { select: { name: true } } },
    }),
  ]);
  return {
    storeId: store.storeId,
    storeName: store.name,
    coinBalance: store.coinBalance,
    recent: recent.map((r) => ({
      storeTxId: r.storeTxId,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      reference: r.reference,
      createdAt: r.createdAt,
    })),
    pendingWithdrawals: pending.map((p) => toRow(p as unknown as WithdrawalRowInternal)),
  };
}

/** Seller history — all of THIS store's withdrawals, newest first. */
export async function listMyWithdrawals(
  ownerUserId: number,
): Promise<WithdrawalRow[]> {
  const store = await getOwnedStore(ownerUserId);
  const rows = await prisma.withdrawal.findMany({
    where: { storeId: store.storeId },
    orderBy: { requestedAt: "desc" },
    include: { store: { select: { name: true } } },
  });
  return rows.map((r) => toRow(r as unknown as WithdrawalRowInternal));
}

/**
 * Seller submits a withdrawal request. Atomic: balance check +
 * deduct + create row + ledger write all inside one transaction.
 * Throws InsufficientStoreBalance (HTTP 400) when amountCoins exceeds
 * the available balance.
 */
export async function requestWithdrawal(
  ownerUserId: number,
  input: RequestWithdrawalInput,
  req?: Request,
): Promise<{ withdrawalId: number; netCoins: number; feeCoins: number; netBaht: string }> {
  const store = await getOwnedStore(ownerUserId);
  const settings = await getSettings();
  const feePercentBp = Math.round(settings.withdrawalFeePercent * 100);

  const result = await prisma.$transaction(async (tx) => {
    // Re-read store row inside the transaction to avoid TOCTOU on
    // coin_balance — Postgres SERIALIZABLE isn't enabled by default,
    // and the CHECK constraint at the SQL layer is the safety net,
    // but a stale balance read here would throw a confusing CHECK
    // violation instead of a clean InsufficientStoreBalance.
    const fresh = await tx.store.findUnique({ where: { storeId: store.storeId } });
    if (!fresh) throw new AppError(404, "StoreNotFound");
    if (input.amountCoins > fresh.coinBalance) {
      throw new AppError(
        400,
        "InsufficientStoreBalance",
        `Need ${input.amountCoins} coins, store has ${fresh.coinBalance}.`,
      );
    }

    const feeCoins = Math.floor((input.amountCoins * feePercentBp) / 10000);
    const netCoins = input.amountCoins - feeCoins;
    const netBaht = new Prisma.Decimal(netCoins).div(COINS_PER_BAHT);
    const balanceAfter = fresh.coinBalance - input.amountCoins;

    await tx.store.update({
      where: { storeId: store.storeId },
      data: { coinBalance: { decrement: input.amountCoins } },
    });

    const row = await tx.withdrawal.create({
      data: {
        storeId: store.storeId,
        amountCoins: input.amountCoins,
        feePercentBp,
        feeCoins,
        netCoins,
        netBaht,
        bankName: input.bankName,
        bankAccountNo: input.bankAccountNo,
        bankAccountName: input.bankAccountName,
        status: "pending",
      },
    });

    await tx.storeTransaction.create({
      data: {
        storeId: store.storeId,
        type: "withdraw",
        amount: -input.amountCoins,
        balanceAfter,
        reference: `withdrawal:${row.withdrawalId}`,
        meta: { feeCoins, netCoins } as Prisma.InputJsonValue,
      },
    });

    await audit({
      actorId: ownerUserId,
      action: "store.withdrawal.request",
      targetType: "withdrawal",
      targetId: row.withdrawalId,
      meta: {
        storeId: store.storeId,
        amountCoins: input.amountCoins,
        feeCoins,
        netCoins,
      },
      req,
    });

    return { withdrawalId: row.withdrawalId, netCoins, feeCoins, netBaht: netBaht.toString() };
  });

  return result;
}

/**
 * Admin queue. `?status=pending` for the active queue (default);
 * `?status=all` for full history.
 */
export async function adminListWithdrawals(
  filter: "pending" | "all",
): Promise<WithdrawalRow[]> {
  const rows = await prisma.withdrawal.findMany({
    where: filter === "pending" ? { status: "pending" } : {},
    orderBy: { requestedAt: filter === "pending" ? "asc" : "desc" },
    include: { store: { select: { name: true } } },
  });
  return rows.map((r) => toRow(r as unknown as WithdrawalRowInternal));
}

export async function adminGetWithdrawal(
  withdrawalId: number,
): Promise<WithdrawalRow | null> {
  const row = await prisma.withdrawal.findUnique({
    where: { withdrawalId },
    include: { store: { select: { name: true } } },
  });
  return row ? toRow(row as unknown as WithdrawalRowInternal) : null;
}

/**
 * Admin marks a request paid. No coin movement — the deduction
 * happened at request time. Just sets status, captures the slip,
 * stamps the reviewer, audits.
 */
export async function approveWithdrawal(
  adminUserId: number,
  withdrawalId: number,
  input: ApproveWithdrawalInput,
  req?: Request,
): Promise<void> {
  const row = await prisma.withdrawal.findUnique({ where: { withdrawalId } });
  if (!row) throw new AppError(404, "WithdrawalNotFound");
  if (row.status !== "pending") {
    throw new AppError(
      400,
      "AlreadyReviewed",
      `Withdrawal is already ${row.status} and cannot be approved.`,
    );
  }
  await prisma.withdrawal.update({
    where: { withdrawalId },
    data: {
      status: "paid",
      paidProofImage: input.paidProofImage,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    },
  });
  await audit({
    actorId: adminUserId,
    action: "admin.withdrawal.approve",
    targetType: "withdrawal",
    targetId: withdrawalId,
    meta: {
      storeId: row.storeId,
      amountCoins: row.amountCoins,
      netCoins: row.netCoins,
    },
    req,
  });
}

/**
 * Admin rejects a request. Refunds the originally-deducted amount
 * back to Store.coinBalance via a withdraw_reverse StoreTransaction
 * row. Atomic with the status flip.
 */
export async function rejectWithdrawal(
  adminUserId: number,
  withdrawalId: number,
  input: RejectWithdrawalInput,
  req?: Request,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await tx.withdrawal.findUnique({ where: { withdrawalId } });
    if (!row) throw new AppError(404, "WithdrawalNotFound");
    if (row.status !== "pending") {
      throw new AppError(
        400,
        "AlreadyReviewed",
        `Withdrawal is already ${row.status} and cannot be rejected.`,
      );
    }
    const store = await tx.store.findUnique({ where: { storeId: row.storeId } });
    if (!store) throw new AppError(404, "StoreNotFound");

    const balanceAfter = store.coinBalance + row.amountCoins;
    await tx.store.update({
      where: { storeId: row.storeId },
      data: { coinBalance: { increment: row.amountCoins } },
    });
    await tx.storeTransaction.create({
      data: {
        storeId: row.storeId,
        type: "withdraw_reverse",
        amount: row.amountCoins,
        balanceAfter,
        reference: `withdrawal:${withdrawalId}`,
        meta: { reason: input.reason } as Prisma.InputJsonValue,
      },
    });
    await tx.withdrawal.update({
      where: { withdrawalId },
      data: {
        status: "rejected",
        rejectionReason: input.reason,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });
    await audit({
      actorId: adminUserId,
      action: "admin.withdrawal.reject",
      targetType: "withdrawal",
      targetId: withdrawalId,
      meta: {
        storeId: row.storeId,
        amountCoins: row.amountCoins,
        reason: input.reason,
      },
      req,
    });
  });
}
