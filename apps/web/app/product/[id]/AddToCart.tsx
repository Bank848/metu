"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Mail, Key, Play, ShoppingBag, Zap } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

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

  async function addToCart(buyNow = false) {
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
        const next = buyNow ? "/cart" : (typeof window !== "undefined" ? window.location.pathname : "/");
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!res.ok) {
        setMessage("Failed to add to cart");
        return;
      }
      setMessage("Added to cart ✓");
      if (buyNow) {
        router.push("/cart");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl glass-morphism p-6">
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
              className={cn(
                "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition relative overflow-hidden",
                isActive
                  ? "bg-gradient-to-r from-metu-yellow/15 to-metu-yellow/5 border border-metu-yellow/50"
                  : "bg-white/[0.02] border border-white/8 hover:border-metu-yellow/30",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-metu-yellow to-metu-gold" />
              )}
              <div className="flex items-center gap-3">
                <Icon className={cn("h-5 w-5", isActive ? "text-metu-yellow" : "text-ink-secondary")} strokeWidth={2} />
                <span className="text-sm font-semibold capitalize text-white">{it.deliveryMethod.replace("_", " ")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                {it.discountPercent > 0 && (
                  <span className="text-xs line-through text-ink-dim">{money(it.price)}</span>
                )}
                <span className="font-display font-bold text-gold-gradient">{money(it.finalPrice)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm font-semibold text-white">Qty</label>
        <div className="flex items-center border border-white/10 rounded-full overflow-hidden bg-surface-2">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-1.5 text-white hover:bg-white/5"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="px-4 font-semibold text-white">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity(Math.min(99, quantity + 1))}
            className="px-3 py-1.5 text-white hover:bg-white/5"
            aria-label="Increase"
          >
            +
          </button>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">Total</div>
          <div className="font-display text-2xl font-extrabold text-gold-gradient">
            {money(active.finalPrice * quantity)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassButton tone="glass" size="lg" onClick={() => addToCart(false)} disabled={busy}>
          <ShoppingBag className="h-4 w-4" />
          Add to cart
        </GlassButton>
        <GlassButton tone="gold" size="lg" onClick={() => addToCart(true)} disabled={busy}>
          <Zap className="h-4 w-4" />
          Buy now
        </GlassButton>
      </div>
      {message && <p className="mt-3 text-sm text-center text-ink-secondary">{message}</p>}
    </div>
  );
}
