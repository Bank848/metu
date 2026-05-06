"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useCartCount } from "@/lib/useCartCount";

/**
 * TopNav cart pill with a live count badge. Earlier rev did its own
 * /api/cart polling, but MobileBottomNav also polls — duplicate
 * requests doubled the load. Both now subscribe to the shared
 * `useCartCount` hook which maintains a single polling loop +
 * cart:update / focus listeners across the whole page.
 */
export function CartNavIcon() {
  const { t } = useI18n();
  const count = useCartCount();

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
