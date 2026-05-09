"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

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
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-metu-yellow hover:border-metu-yellow/50 hover:bg-metu-yellow/10 hover:text-metu-yellow transition"
    >
      <ShoppingCart className="h-[18px] w-[18px]" />
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
