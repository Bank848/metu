"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Mail, Key, Play, ShoppingBag, Zap, CheckCircle2, BadgeCheck, ArrowRight } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { coins, thbToCoins } from "@/lib/format";
import { play } from "@/lib/sound";
import { cn } from "@/lib/utils";

type Item = {
  productItemId: number;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  deliveryMethod: string;
  price: number;
  finalPrice: number;
  discountPercent: number;
  stock: number;
};

const DELIVERY_LABEL: Record<string, string> = {
  download:    "Instant Download",
  email:       "Delivered by Email",
  license_key: "License Key",
  streaming:   "Streaming Access",
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
  isStackable = false,
}: {
  items: Item[];
  ownedOrderId?: number | null;
  /** Product-level flag — when true, the license_key variants on this
   *  product accept qty > 1 (buyer collects multiple keys). Other
   *  digital methods still cap at 1 per cart line. */
  isStackable?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number>(items[0]?.productItemId);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const active = items.find((i) => i.productItemId === selected)!;
  const isDigital = active && DIGITAL.has(active.deliveryMethod);
  // Stackable license_key: ceiling = stock (or 99 if seller left stock
  // null/unlimited). Other digital methods: hard cap 1.
  const STACKABLE_KEY_FALLBACK = 99;
  const isStackableKey = isStackable && active?.deliveryMethod === "license_key";
  const maxQty = isStackableKey
    ? Math.max(1, active?.stock ?? STACKABLE_KEY_FALLBACK)
    : isDigital
      ? 1
      : Math.max(1, active?.stock ?? 1);

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
        if (data?.error === "AlreadyOwned") {
          router.refresh();
        }
        return;
      }
      setMessage("Added to cart ✓");
      setJustAdded(true);
      play("cart");
      setTimeout(() => setJustAdded(false), 900);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart:update"));
      }
      // Buy now → full-page navigation so the destination /cart route
      // bypasses Next 14's App Router segment cache (router.refresh()
      // only invalidates the CURRENT route, so a cached /cart payload
      // from an earlier visit would render before the fresh fetch
      // landed and the user wouldn't see the just-added line). For
      // plain "Add to cart" we stay on the product page and trigger a
      // refresh + the cart:update event so the nav icon counter
      // updates without leaving the page.
      if (buyNow) {
        if (typeof window !== "undefined") {
          window.location.href = "/cart";
        }
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
    }
  }

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
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-metu-yellow/10 p-6 shadow-flat">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-3">
        Choose a variant
      </div>
      <div className="space-y-2 mb-5">
        {items.map((it) => {
          const Icon = deliveryIcon[it.deliveryMethod] ?? Download;
          const isActive = it.productItemId === selected;
          const hasDiscount = it.discountPercent > 0;

          return (
            <button
              key={it.productItemId}
              type="button"
              onClick={() => setSelected(it.productItemId)}
              className={cn(
                "w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left transition relative overflow-hidden",
                isActive
                  ? "bg-gradient-to-r from-metu-yellow/15 to-metu-yellow/5 border border-metu-yellow/50"
                  : "bg-white/[0.02] border border-white/8 hover:border-metu-yellow/30",
              )}
            >
              {/* Active left bar */}
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-metu-yellow to-metu-gold" />
              )}

              {/* Variant image */}
              {it.image && (
                <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-white/10">
                  <img src={it.image} alt={it.name ?? ""} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Name */}
                <p className={cn(
                  "text-sm font-semibold leading-tight mb-0.5",
                  isActive ? "text-white" : "text-zinc-300",
                )}>
                  {it.name || DELIVERY_LABEL[it.deliveryMethod] || it.deliveryMethod.replace("_", " ")}
                </p>

                {/* Description */}
                {it.description && (
                  <p className="text-[11px] text-ink-secondary leading-relaxed mb-1.5 line-clamp-2">
                    {it.description}
                  </p>
                )}

                {/* Delivery + stock badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    isActive
                      ? "border-mint/40 bg-mint/10 text-mint"
                      : "border-white/10 bg-white/5 text-ink-dim",
                  )}>
                    <Icon className="h-2.5 w-2.5" />
                    {DELIVERY_LABEL[it.deliveryMethod] ?? it.deliveryMethod}
                  </span>

                  {!DIGITAL.has(it.deliveryMethod) && (
                    <span className="text-[10px] text-ink-dim">
                      {it.stock <= 0
                        ? "Out of stock"
                        : it.stock <= 5
                          ? `Only ${it.stock} left`
                          : `${it.stock} in stock`}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="shrink-0 text-right ml-2">
                <div className="font-display font-bold text-gold-gradient text-base italic leading-none">
                  {coins(thbToCoins(it.finalPrice))}
                </div>
                {hasDiscount && (
                  <>
                    <div className="text-[11px] text-zinc-500 line-through mt-0.5">
                      {coins(thbToCoins(it.price))}
                    </div>
                    <div className="text-[10px] font-black text-red-400">
                      −{it.discountPercent}%
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm font-semibold text-white">Qty</label>
        <div className={cn(
          "flex items-center border rounded-full overflow-hidden bg-surface-2",
          isDigital && !isStackableKey ? "border-white/5 opacity-70" : "border-white/10",
        )}>
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={(isDigital && !isStackableKey) || quantity <= 1}
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
            disabled={isDigital && !isStackableKey}
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
            disabled={(isDigital && !isStackableKey) || quantity >= maxQty}
            className="px-3 py-1.5 text-white hover:bg-white/5 disabled:opacity-30"
            aria-label="Increase"
          >
            +
          </button>
        </div>
        {isDigital && !isStackableKey && (
          <span className="text-[11px] text-ink-dim">Digital · 1 per order</span>
        )}
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">Total</div>
          <div className="font-display text-2xl font-extrabold text-gold-gradient">
            {coins(thbToCoins(active.finalPrice * quantity))}
          </div>
        </div>
      </div>

      {!isDigital && active?.stock === 0 && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <span className="text-sm text-amber-200">This variant is out of stock.</span>
        </div>
      )}

      <div className="relative grid grid-cols-2 gap-3">
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
