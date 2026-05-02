"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Mail, Key, Play, ShoppingBag, Zap, CheckCircle2, FileDown, BadgeCheck, ArrowRight } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { coins, thbToCoins } from "@/lib/format";
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
};

const deliveryIcon: Record<string, React.ElementType> = {
  download: Download,
  email: Mail,
  license_key: Key,
  streaming: Play,
};

const DIGITAL = new Set(["download", "email", "license_key", "streaming"]);

export function AddToCart({
  items,
  ownedOrderId,
}: {
  items: Item[];
  /**
   * Phase 48 — when set, the buyer already owns this product (paid /
   * fulfilled / pending order). Page passes `null` for stackable
   * products (license_key, seller-overridden) so this banner only
   * appears for true single-copy assets.
   */
  ownedOrderId?: number | null;
}) {
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
        const data = await res.json().catch(() => ({} as { message?: string; error?: string; orderId?: number }));
        setMessage(data?.message ?? "Failed to add to cart");
        play("error");
        // Phase 48 — AlreadyOwned: refresh so the parent re-fetches
        // `getOwnedOrderId` and swaps the buy box for the
        // "✓ Already in your library" banner pointing at the
        // existing order.
        if (data?.error === "AlreadyOwned") {
          router.refresh();
        }
        return;
      }
      setMessage("Added to cart ✓");
      setJustAdded(true);
      play("cart");
      setTimeout(() => setJustAdded(false), 900);
      // Phase 11 run #2 / F8 — broadcast a cart-mutation event so the
      // <CartNavIcon> in TopNav re-fetches `/api/cart` immediately.
      // `router.refresh()` alone wasn't enough because the count lives
      // in a client component that owns its own state; the event lets
      // the badge update within ~200ms instead of waiting for the next
      // 60s background poll. The optional-chain guard keeps this safe
      // for SSR where `window` is undefined.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart:update"));
      }
      // Keep the router refresh — it still picks up server-rendered
      // affordances elsewhere on the page (e.g. order totals after a
      // checkout-style "Buy now").
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

  // Phase 48 — when the buyer already owns this single-copy product,
  // swap the buy box for a mint banner pointing back at the existing
  // order. We still render the variant + sample link so the buyer can
  // click into the variant they bought (handy for multi-variant pages
  // where the link is the only way back to the file).
  if (ownedOrderId) {
    return (
      <div className="rounded-2xl surface-accent p-6 shadow-flat space-y-4">
        <div className="rounded-xl border border-mint/40 bg-mint/10 p-4 flex items-start gap-3">
          <BadgeCheck className="h-5 w-5 text-mint shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-semibold text-mint mb-0.5">
              ✓ Already in your library
            </div>
            <div className="text-ink-secondary">
              You bought this product in a previous order. Single-copy
              digital goods can&apos;t be re-purchased — open the order
              to download / view again.
            </div>
          </div>
        </div>
        <Link
          href={`/orders/${ownedOrderId}`}
          className="inline-flex items-center gap-2 rounded-pill bg-mint text-space-950 px-5 py-2.5 text-sm font-semibold hover:bg-mint/90 transition"
        >
          View order #{ownedOrderId}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {active?.sampleUrl && (
          <a
            href={active.sampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-metu-yellow hover:underline ml-3"
          >
            <FileDown className="h-3 w-3" />
            Free sample
          </a>
        )}
      </div>
    );
  }

  return (
    // Wave-3: anchor the buy-box on the mint accent surface so it reads
    // as the "look here" card on the page. Gold-gradient is now reserved
    // for the price + the "Buy now" CTA only — see docs/design-system.md §5.
    <div className="rounded-2xl surface-accent p-6 shadow-flat">
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
                  <span className="text-xs line-through text-ink-dim">{coins(thbToCoins(it.price))}</span>
                )}
                <span className="font-display font-bold text-gold-gradient">{coins(thbToCoins(it.finalPrice))}</span>
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
            {coins(thbToCoins(active.finalPrice * quantity))}
          </div>
        </div>
      </div>

      {/* Phase 26 — out-of-stock variants now show a static notice
          instead of the StockAlertButton (restock-notification feature
          was removed alongside the messaging surface). */}
      {!isDigital && active?.stock === 0 && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <span className="text-sm text-amber-200">This variant is out of stock.</span>
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
