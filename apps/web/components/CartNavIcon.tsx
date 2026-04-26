"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * Phase 11 run #2 / F8 — TopNav cart pill with a live count badge.
 *
 * The previous static `<Link>` showed only the bag icon, so a buyer
 * couldn't tell whether their `Add to cart` click registered until they
 * navigated to `/cart`. We mirror the MessagesNavIcon pattern: client
 * component that polls `/api/cart` on a slow tick (60s, same cadence
 * as MessagesNavIcon), and refreshes immediately whenever AddToCart
 * dispatches a `cart:update` window event.
 *
 * Renders for guests too — guests get a silent zero badge so the
 * entry point stays visible. The 401 branch swallows the error and
 * leaves the count at 0.
 */
export function CartNavIcon() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const lines: Array<{ quantity: number }> = Array.isArray(data?.items) ? data.items : [];
      const next = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
      setCount(next);
    } catch {
      /* swallow — keep the previous count visible */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    // PDP `Add to cart` dispatches this window event after a successful
    // POST so the badge updates without waiting for the 60s poll. We
    // also listen on `focus` so switching back from another tab picks
    // up out-of-band changes (e.g. a checkout completed elsewhere).
    const onUpdate = () => refresh();
    window.addEventListener("cart:update", onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("cart:update", onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refresh]);

  const label = t("nav.cart");
  return (
    <Link
      href="/cart"
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white hover:border-metu-yellow/50 hover:bg-metu-yellow/10 hover:text-metu-yellow transition"
    >
      <ShoppingBag className="h-[18px] w-[18px]" />
      {count > 0 && (
        <span
          aria-label={`${count} item${count === 1 ? "" : "s"} in cart`}
          className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-metu-yellow px-1 text-[9px] font-bold text-space-black ring-2 ring-surface-1"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
