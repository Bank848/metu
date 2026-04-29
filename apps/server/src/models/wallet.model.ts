/**
 * Phase 17.1 — wallet resource DTOs.
 *
 * Read shape covers /wallet (balance + recent ledger entries).
 * Write shape covers admin grant — top-up flows ship in 17.3.
 */
import { z } from "zod";

export interface WalletBalanceResponse {
  balance: number;
  walletEnabled: boolean;
}

export interface WalletTxRow {
  id: number;
  type: "topup" | "spend" | "refund" | "grant";
  amount: number;
  balanceAfter: number;
  reference: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface WalletTxListResponse {
  balance: number;
  transactions: WalletTxRow[];
}

/** Admin grant — credits coins to any user with a reason. */
export const adminGrantSchema = z.object({
  amount: z.number().int().positive().max(10_000_000),
  reason: z.string().trim().min(1).max(200),
});
export type AdminGrantInput = z.infer<typeof adminGrantSchema>;
