import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/server/api";
import { safeGetSettings } from "@/lib/settings";
import { WithdrawalRequestForm } from "./WithdrawalRequestForm";

export const dynamic = "force-dynamic";

interface WalletData {
  storeId: number;
  storeName: string;
  coinBalance: number;
}

export default async function RequestWithdrawalPage() {
  const [wallet, settings] = await Promise.all([
    apiFetch<WalletData>("/seller/wallet"),
    safeGetSettings(),
  ]);

  // Below the 100-coin minimum the request endpoint will reject
  // anyway — bounce back to /seller/wallet so the seller doesn't
  // hit a confusing form-validation error.
  if (wallet.coinBalance < 100) redirect("/seller/wallet");

  return (
    <>
      <Link
        href="/seller/wallet"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to wallet
      </Link>
      <PageHeader
        title="Request withdrawal"
        subtitle={`Available: ${wallet.coinBalance.toLocaleString()} coins (≈ ฿${(wallet.coinBalance / 10).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
      />
      <WithdrawalRequestForm
        availableCoins={wallet.coinBalance}
        withdrawalFeePercent={settings.withdrawalFeePercent}
      />
    </>
  );
}
