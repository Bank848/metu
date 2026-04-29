import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { coins } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { TopupReviewActions } from "./TopupReviewActions";

export const dynamic = "force-dynamic";

interface TopupRow {
  topupId: number;
  amountBaht: number;
  coinsExpected: number;
  status: "pending" | "paid" | "rejected" | "expired";
  user: { userId: number; username: string; email: string };
  slipImage: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * Phase 17.3 — admin top-up review queue.
 *
 * Lists every pending top-up (auto-verified ones never appear here —
 * they get credited immediately by submitSlip). Admin can:
 *   - Inspect the uploaded slip image
 *   - Approve manually (credits coins + audits)
 *   - Reject with reason (no coins; user can re-submit)
 *
 * The slip image is stored as a base64 data URL so we render it
 * inline. Trade-off: bloats the page payload when there are many
 * pending slips with images. For demo scale this is fine; if it
 * ever grows we can move to lazy-loaded thumbnails or external
 * storage.
 */
export default async function AdminTopupsPage() {
  const data = await apiFetch<{ topups: TopupRow[] }>("/admin/topups?status=pending");

  return (
    <main id="main" className="px-8 py-8 max-w-5xl">
      <PageHeader
        title="Top-up review"
        subtitle="Slips that auto-verify never land here — only failed-verify slips waiting for manual review."
      />

      {data.topups.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Inbox zero — no pending top-ups"
            description="Every slip submitted has either auto-verified or already been resolved."
            icon={<Banknote className="h-8 w-8" />}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {data.topups.map((t) => (
            <li
              key={t.topupId}
              className="rounded-2xl border border-line bg-space-900 p-5 flex flex-col md:flex-row gap-5"
            >
              {/* Slip image preview (base64 inline) */}
              <div className="shrink-0 w-full md:w-64">
                {t.slipImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.slipImage}
                    alt="Payment slip"
                    className="w-full max-h-72 rounded-xl border border-line object-contain bg-black/40"
                  />
                ) : (
                  <div className="w-full h-32 rounded-xl border border-dashed border-line bg-black/20 flex items-center justify-center text-xs text-ink-dim">
                    No slip uploaded yet
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-display text-lg font-bold text-white">
                  ฿{t.amountBaht.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-mint">
                    → {coins(t.coinsExpected)}
                  </span>
                </div>
                <div className="text-sm text-ink-secondary">
                  <span className="font-mono">@{t.user.username}</span> · {t.user.email}
                </div>
                <div className="mt-1 text-xs text-ink-dim">
                  Submitted {new Date(t.createdAt).toLocaleString("th-TH")}
                </div>
                <div className="mt-3 inline-block rounded-full bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                  Auto-verify failed — needs manual review
                </div>

                <TopupReviewActions topupId={t.topupId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
