"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Mail, Key, Play, ShoppingBag, Zap, CheckCircle2, FileDown } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { StockAlertButton } from "@/components/StockAlertButton";
import { money } from "@/lib/format";
import { play } from "@/lib/sound";
import { cn } from "@/lib/utils";

type Item = {
  productItemId: number;
  deliveryMethod: string;
  price: number;
  finalPrice: number;
  discountPercent: number;
  stock: number;
  sampleUrl?: string | null;
  alreadySubscribed?: boolean;
};

const deliveryIcon: Record<string, React.ElementType> = {
  download: Download,
  email: Mail,
  license_key: Key,
  streaming: Play,
};

const DIGITAL = new Set(["download", "email", "license_key", "streaming"]);

export function AddToCart({ items }: { items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number>(items[0]?.productItemId);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Used to trigger a one-shot pulse animation on the Add-to-cart button
  // when the add succeeds — visual confirmation beyond the toast text.
  const [justAdded, setJustAdded] = useState(false);

  const active = items.find((i) => i.productItemId === selected)!;
  const isDigital = active && DIGITAL.has(active.deliveryMethod);
  const maxQty = isDigital ? 1 : Math.max(1, active?.stock ?? 1);

  // Snap quantity back into the valid range whenever the variant changes.
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), maxQty));
  }, [maxQty]);

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
        const data = await res.json().catch(() => ({}));
        setMessage(data?.message ?? "Failed to add to cart");
        play("error");
        return;
      }
      setMessage("Added to cart ✓");
      setJustAdded(true);
      play("cart");
      setTimeout(() => setJustAdded(false), 900);
      // Ask the layout to re-read the cart count so the TopNav badge
      // increments without a page navigation.
      router.refresh();
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
                <div className="min-w-0">
                  <div className="text-sm font-semibold capitalize text-white">{it.deliveryMethod.replace("_", " ")}</div>
                  <div className="text-[10px] text-ink-dim mt-0.5">
                    {DIGITAL.has(it.deliveryMethod)
                      ? "Digital · single-use"
                      : it.stock <= 0
                        ? "Out of stock"
                        : it.stock <= 5
                          ? `Only ${it.stock} left`
                          : `${it.stock} in stock`}
                  </div>
                </div>
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
        <div className={cn(
          "flex items-center border rounded-full overflow-hidden bg-surface-2",
          isDigital ? "border-white/5 opacity-70" : "border-white/10",
        )}>
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={isDigital || quantity <= 1}
            className="px-3 py-1.5 text-white hover:bg-white/5 disabled:opacity-30"
            aria-label="Decrease"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={quantity}
            disabled={isDigital}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              setQuantity(Math.min(maxQty, Math.max(1, Math.floor(n))));
            }}
            className="w-12 bg-transparent text-center font-semibold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:text-ink-dim"
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
            disabled={isDigital || quantity >= maxQty}
            className="px-3 py-1.5 text-white hover:bg-white/5 disabled:opacity-30"
            aria-label="Increase"
          >
            +
          </button>
        </div>
        {isDigital && (
          <span className="text-[11px] text-ink-dim">Digital · 1 per order</span>
        )}
        {/* Free preview / sample link — only when the seller has set one. */}
        {active?.sampleUrl && (
          <a
            href={active.sampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-metu-yellow hover:underline"
          >
            <FileDown className="h-3 w-3" />
            Free sample
          </a>
        )}
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">Total</div>
          <div className="font-display text-2xl font-extrabold text-gold-gradient">
            {money(active.finalPrice * quantity)}
          </div>
        </div>
      </div>

      {/* Out-of-stock notify-me — only physical variants. */}
      {!isDigital && active?.stock === 0 && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 flex items-center justify-between gap-3">
          <span className="text-sm text-amber-200">This variant is out of stock.</span>
          <StockAlertButton
            productItemId={active.productItemId}
            initialSubscribed={Boolean(active.alreadySubscribed)}
          />
        </div>
      )}

      <div className="relative grid grid-cols-2 gap-3">
        {/* Floating +QTY indicator — rises above the Add button when an
            add succeeds, paired with the atc-pulse shadow ring. */}
        {justAdded && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/4 top-0 -translate-x-1/2 z-10 rounded-full bg-metu-yellow text-surface-1 text-xs font-bold px-2.5 py-1 shadow-lg animate-[atc-float_0.9s_ease-out_forwards]"
          >
            +{quantity} added
          </span>
        )}
        <GlassButton
          tone="glass"
          size="lg"
          onClick={() => addToCart(false)}
          disabled={busy || active?.stock === 0 && !isDigital}
          className={cn(justAdded && "animate-[atc-pulse_0.9s_ease-out]")}
        >
          {justAdded ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <ShoppingBag className="h-4 w-4" />}
          {justAdded ? "Added" : "Add to cart"}
        </GlassButton>
        <GlassButton tone="gold" size="lg" onClick={() => addToCart(true)} disabled={busy || active?.stock === 0 && !isDigital}>
          <Zap className="h-4 w-4" />
          Buy now
        </GlassButton>
      </div>
      {message && (
        <p className={cn(
          "mt-3 text-sm text-center transition",
          message.startsWith("Added") ? "text-green-400" : "text-ink-secondary",
        )}>
          {message}
        </p>
      )}
    </div>
  );
}
