import Link from "next/link";
import { Wallet } from "lucide-react";
import { coins } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/server/api";

/**
 * Phase 17.3 — server-side wallet balance pill in the TopNav.
 *
 * Renders the user's coin balance as a clickable pill that links to
 * /wallet. Server fetched per-render — Next dedupes within the same
 * request so calling apiFetch here costs nothing extra if /wallet is
 * already being read elsewhere on the page.
 *
 * Falls back silently to "Wallet" label on any error (logged-out, API
 * blip) so a transient outage doesn't blow up the layout.
 */
export async function WalletNavPill() {
  let balance: number | null = null;
  try {
    const data = await apiFetch<{ balance: number }>("/wallet");
    balance = data.balance;
  } catch (e) {
    if (!(e instanceof ApiError)) {
      // Re-throw real errors so we don't silently break the page.
      throw e;
    }
  }
  return (
    <Link
      href="/wallet"
      aria-label="Wallet"
      title="Wallet"
      className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-metu-yellow/30 bg-metu-yellow/10 px-3 h-9 text-sm font-semibold text-metu-yellow hover:bg-metu-yellow/15 transition tabular-nums"
    >
      <Wallet className="h-3.5 w-3.5" />
      {balance === null ? "Wallet" : coins(balance)}
    </Link>
  );
}
