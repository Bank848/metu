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

// ─────────────────────────────────────────────────────────────────
// Phase 17.3 — top-up flow
// ─────────────────────────────────────────────────────────────────

/** POST /wallet/topup — request a fresh top-up + receive QR payload. */
export const requestTopupSchema = z.object({
  amountBaht: z
    .number()
    .int()
    .min(20, "Minimum top-up is 20 baht")
    .max(50_000, "Maximum top-up is 50,000 baht per request"),
});
export type RequestTopupInput = z.infer<typeof requestTopupSchema>;

export interface RequestTopupResponse {
  topupId: number;
  amountBaht: number;
  coinsExpected: number;
  promptpayPayload: string;
  promptpayId: string;
  expiresAt: Date;
}

/** POST /wallet/topup/:id/slip — submit a payment slip image. */
export const submitSlipSchema = z.object({
  slipImage: z
    .string()
    .min(50, "Slip image is required")
    // base64 data URL — accept any image type that includes a data: prefix
    .regex(/^data:image\/(png|jpe?g);base64,/, "Slip image must be PNG or JPEG"),
});
export type SubmitSlipInput = z.infer<typeof submitSlipSchema>;

export interface SubmitSlipResponse {
  topupId: number;
  status: "pending" | "paid" | "rejected";
  /** True when the slip QR auto-verified + coins credited immediately. */
  autoApproved: boolean;
  /** Why the slip was rejected (only set when status === "rejected"). */
  rejectionReason?: string;
  /** New balance after auto-credit (only set when autoApproved === true). */
  balanceAfter?: number;
}

export interface TopupRow {
  topupId: number;
  amountBaht: number;
  coinsExpected: number;
  status: "pending" | "paid" | "rejected" | "expired";
  /** Just the username/email for the admin queue table. */
  user: { userId: number; username: string; email: string };
  slipImage: string | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

/** POST /admin/topups/:id/{approve,reject} — admin moderation actions. */
export const rejectTopupSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});
export type RejectTopupInput = z.infer<typeof rejectTopupSchema>;
