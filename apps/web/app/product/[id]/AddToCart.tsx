"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Mail, Key, Play, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";

type Item = {
  productItemId: number;
  deliveryMethod: string;
  price: number;
  finalPrice: number;
  discountPercent: number;
};

const deliveryIcon: Record<string, React.ElementType> = {
  download: Download,
  email: Mail,
  license_key: Key,
  streaming: Play,
};

export function AddToCart({ items }: { items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number>(items[0]?.productItemId);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const active = items.find((i) => i.productItemId === selected)!;

  async function addToCart() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productItemId: selected, quantity }),
        credentials: "include",
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`);
        return;
      }
      if (!res.ok) {
        setMessage("Failed to add to cart");
        return;
      }
      setMessage("Added to cart ✓");
      router.refresh();
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-space-850 p-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-3">
        Choose a variant
      </div>
      <div className="space-y-2 mb-5">
        {items.map((it) => {
          const Icon = deliveryIcon[it.deliveryMethod] ?? Download;
          const isActive = it.productItemId === selected;
          return (
            <button
              key={it.productItemId}
              type="button"
              onClick={() => setSelected(it.productItemId)}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                isActive ? "border-brand-yellow bg-brand-yellow/10" : "border-line hover:border-brand-yellow/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${isActive ? "text-brand-yellow" : "text-ink-secondary"}`} strokeWidth={2} />
                <span className="text-sm font-semibold capitalize text-white">{it.deliveryMethod.replace("_", " ")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                {it.discountPercent > 0 && (
                  <span className="text-xs line-through text-ink-dim">{money(it.price)}</span>
                )}
                <span className="font-display font-bold text-brand-yellow">{money(it.finalPrice)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm font-semibold text-white">Qty</label>
        <div className="flex items-center border border-line rounded-full overflow-hidden bg-space-900">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-2 text-white hover:bg-white/5"
          >
            −
          </button>
          <span className="px-4 font-semibold text-white">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity(Math.min(99, quantity + 1))}
            className="px-3 py-2 text-white hover:bg-white/5"
          >
            +
          </button>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-ink-dim">Total</div>
          <div className="font-display text-2xl font-extrabold text-brand-yellow">{money(active.finalPrice * quantity)}</div>
        </div>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={addToCart} disabled={busy}>
        <ShoppingBag className="h-4 w-4" />
        {busy ? "Adding…" : "Add to cart"}
      </Button>
      {message && <p className="mt-3 text-sm text-center text-ink-secondary">{message}</p>}
    </div>
  );
}
