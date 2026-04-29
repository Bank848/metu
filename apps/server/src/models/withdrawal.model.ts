/**
 * Phase 20.2 — withdrawal DTOs.
 *
 * Bank account validation pinned to Thai retail conventions:
 *   - bankName: free text, 2..60 chars (no fixed list — covers
 *     state banks, private banks, mobile-only banks)
 *   - bankAccountNo: 10..12 digits, no spaces (matches every Thai
 *     bank's print format)
 *   - bankAccountName: 2..80 chars (Thai script + ASCII allowed)
 *
 * Minimum withdrawal is 100 coins (≈ ฿10) — guards against accidental
 * sub-baht requests that would round to zero baht net after fee.
 */
import { z } from "zod";

export const requestWithdrawalSchema = z.object({
  amountCoins: z
    .number()
    .int()
    .min(100, "Minimum withdrawal is 100 coins (฿10).")
    .max(10_000_000, "Withdraw at most 10,000,000 coins per request."),
  bankName: z.string().trim().min(2).max(60),
  bankAccountNo: z
    .string()
    .trim()
    .regex(/^[0-9]{10,12}$/, "Thai bank account number must be 10–12 digits, no spaces."),
  bankAccountName: z.string().trim().min(2).max(80),
});
export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;

export const approveWithdrawalSchema = z.object({
  // base64 data URL — admin uploads the bank-transfer slip image as
  // proof. Mirrors topup.slipImage. Max payload guarded by
  // express.json({limit:"1mb"}) at the app layer.
  paidProofImage: z
    .string()
    .min(50)
    .regex(
      /^data:image\/(png|jpe?g);base64,/,
      "Slip must be a PNG or JPEG data URL.",
    ),
});
export type ApproveWithdrawalInput = z.infer<typeof approveWithdrawalSchema>;

export const rejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});
export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;

export interface WithdrawalRow {
  withdrawalId: number;
  storeId: number;
  storeName: string;
  amountCoins: number;
  feePercentBp: number;
  feeCoins: number;
  netCoins: number;
  netBaht: string; // Decimal serialised as string for JSON safety
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

export interface SellerWalletResponse {
  storeId: number;
  storeName: string;
  coinBalance: number;
  recent: Array<{
    storeTxId: number;
    type: "earn" | "withdraw" | "withdraw_reverse" | "refund_clawback" | "adjustment";
    amount: number;
    balanceAfter: number;
    reference: string | null;
    createdAt: Date;
  }>;
  pendingWithdrawals: WithdrawalRow[];
}
