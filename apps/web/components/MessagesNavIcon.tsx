"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * TopNav chat icon — client component so it can poll
 * `/api/messages/unread` on the same 60s cadence as `SellerSidebar`.
 *
 * Visual sibling to the Cart pill: rounded-xl square, hairline border,
 * mint hover tint instead of yellow so the two activity icons read as
 * "you have stuff here" without feeling interchangeable. The unread
 * count rides as a small mint dot in the top-right corner.
 *
 * Falls back to a silent badge if the fetch errors so a logged-out
 * visitor or transient 401 never paints a stale "0 unread".
 */
export function MessagesNavIcon({ enabled = true }: { enabled?: boolean }) {
  const { t } = useI18n();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/messages/unread", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(Number(data.count) || 0);
      } catch {
        /* swallow */
      }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  const label = t("nav.messages");
  return (
    <Link
      href={enabled ? "/messages" : "/login?next=/messages"}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white hover:border-mint/50 hover:bg-mint/10 hover:text-mint transition"
    >
      <Mail className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-mint px-1 text-[9px] font-bold text-mint-deep ring-2 ring-surface-1"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
