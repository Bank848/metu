"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Tag as TagIcon, ShieldCheck, Sparkles, ShoppingBag } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { money } from "@/lib/format";
import { cn, isDataUrl } from "@/lib/utils";

type Line = {
  cartItemId: number;
  productItemId: number;
  productId: number;
  productName: string;
  storeName: string;
  image: string | null;
  deliveryMethod: string;
  unitPrice: number;
  basePrice: number;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
};

type Cart = { cartId: number; subtotal: number; items: Line[] };

const API = "/api";

export function CartLines({ cart: initial }: { cart: Cart }) {
  const router = useRouter();
  const [cart, setCart] = useState(initial);
  const [coupon, setCoupon] = useState("");
  const [couponFocused, setCouponFocused] = useState(false);
  const [couponResult, setCouponResult] = useState<null | { valid: boolean; code?: string; reason?: string; discountType?: string; discountValue?: number }>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = cart.items.reduce((a, b) => a + b.lineTotal, 0);
  const discount = (() => {
    if (!couponResult?.valid) return 0;
    if (couponResult.discountType === "percent") return (subtotal * (couponResult.discountValue ?? 0)) / 100;
    return Math.min(subtotal, couponResult.discountValue ?? 0);
  })();
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.items.reduce((a, b) => a + b.quantity, 0);

  async function updateQty(cartItemId: number, quantity: number) {
    const res = await fetch(`${API}/cart/items/${cartItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
      credentials: "include",
    });
    if (res.ok) {
      setCart({
        ...cart,
        items: cart.items.map((l) =>
          l.cartItemId === cartItemId ? { ...l, quantity, lineTotal: l.unitPrice * quantity } : l,
        ),
      });
    }
  }

  async function remove(cartItemId: number) {
    const res = await fetch(`${API}/cart/items/${cartItemId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setCart({ ...cart, items: cart.items.filter((l) => l.cartItemId !== cartItemId) });
    }
  }

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim() }),
        credentials: "include",
      });
      const data = await res.json();
      setCouponResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponResult?.valid ? couponResult.code : undefined }),
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setBusy(false);
      router.push(`/orders/${data.orderId}?new=1`);
    } catch {
      setBusy(false);
    }
  }

  // Group by store
  const byStore = new Map<string, Line[]>();
  for (const l of cart.items) {
    const arr = byStore.get(l.storeName) ?? [];
    arr.push(l);
    byStore.set(l.storeName, arr);
  }

  return (
    <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
      {/* ───── Lines ───── */}
      <div className="space-y-6">
        {[...byStore.entries()].map(([store, lines]) => (
          <section key={store} className="rounded-2xl glass-morphism overflow-hidden">
            {/* store header with gold rule */}
            <div className="px-5 py-3 flex items-center gap-2 border-b border-white/8 bg-gradient-to-r from-metu-yellow/8 via-transparent to-transparent">
              <ShieldCheck className="h-3.5 w-3.5 text-metu-yellow" />
              <span className="text-sm font-semibold text-white">{store}</span>
            </div>

            <ul className="divide-y divide-white/6">
              {lines.map((l) => (
                <li key={l.cartItemId} className="flex items-center gap-4 p-4">
                  <div className="relative h-20 w-20 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8">
                    {l.image && <Image src={l.image} alt="" fill sizes="80px" className="object-cover" unoptimized={isDataUrl(l.image)} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${l.productId}`} className="font-semibold text-white hover:text-metu-yellow line-clamp-1">
                      {l.productName}
                    </Link>
                    <div className="text-xs text-ink-dim capitalize mt-0.5 inline-flex items-center gap-2">
                      <span>{l.deliveryMethod.replace("_", " ")}</span>
                      {l.discountPercent > 0 && (
                        <span className="text-metu-yellow font-semibold">−{l.discountPercent}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-white/10 rounded-full overflow-hidden bg-surface-2">
                        <button type="button" onClick={() => updateQty(l.cartItemId, Math.max(1, l.quantity - 1))} className="px-2 py-1 text-white hover:bg-white/5">−</button>
                        <span className="px-3 text-sm font-semibold text-white">{l.quantity}</span>
                        <button type="button" onClick={() => updateQty(l.cartItemId, l.quantity + 1)} className="px-2 py-1 text-white hover:bg-white/5">+</button>
                      </div>
                      <button type="button" onClick={() => remove(l.cartItemId)} className="text-ink-dim hover:text-metu-red transition" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-display text-lg font-bold text-gold-gradient">{money(l.lineTotal)}</div>
                    <div className="text-xs text-ink-dim">{money(l.unitPrice)} ea</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* ───── Summary ───── */}
      <aside className="rounded-2xl glass-morphism-strong p-6 sticky top-28">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-metu-yellow" />
          <h2 className="font-display text-lg font-bold text-white">Order summary</h2>
        </div>

        {/* Coupon — gradient border on focus */}
        <form onSubmit={applyCoupon} className="space-y-2 mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
            Coupon code
          </label>
          <div
            className={cn(
              "rounded-pill p-px transition",
              couponFocused
                ? "bg-gradient-to-r from-metu-yellow via-metu-gold to-metu-yellow"
                : "bg-white/8",
            )}
          >
            <div className="flex gap-2 rounded-pill bg-surface-2 p-1 pl-1">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                onFocus={() => setCouponFocused(true)}
                onBlur={() => setCouponFocused(false)}
                placeholder="Have a code? Paste it here"
                className="flex-1 rounded-pill bg-transparent px-4 py-1.5 text-sm text-white placeholder:text-ink-dim focus:outline-none"
              />
              <button
                type="submit"
                disabled={!coupon || busy}
                className="rounded-pill button-gradient px-4 text-xs disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
          {couponResult && (
            <p className={cn("text-xs flex items-center gap-1", couponResult.valid ? "text-green-400" : "text-red-400")}>
              {couponResult.valid ? (
                <>
                  <TagIcon className="h-3 w-3" />
                  <span><strong>{couponResult.code}</strong> applied · −{couponResult.discountValue}{couponResult.discountType === "percent" ? "%" : " off"}</span>
                </>
              ) : (
                couponResult.reason
              )}
            </p>
          )}
        </form>

        {/* Money rows */}
        <div className="space-y-1.5 text-sm mb-4">
          <Row label={`Subtotal (${itemCount} item${itemCount !== 1 ? "s" : ""})`} value={subtotal} />
          {discount > 0 && <Row label="Discount" value={-discount} accent="green" />}
          <div className="border-t border-white/8 my-3" />
          <div className="flex justify-between items-baseline">
            <span className="text-white font-semibold">Total</span>
            <span className="font-display text-2xl font-extrabold text-gold-gradient">
              {money(total)}
            </span>
          </div>
        </div>

        <GlassButton tone="gold" size="lg" fullWidth onClick={checkout} disabled={cart.items.length === 0 || busy}>
          <ShoppingBag className="h-4 w-4" />
          {busy ? "Processing…" : "Checkout →"}
        </GlassButton>
        <p className="mt-3 text-[11px] text-ink-dim text-center">
          Demo checkout — no real payment will be processed.
        </p>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: "default" | "green";
}) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className={cn("font-semibold", accent === "green" ? "text-green-400" : "text-white")}>
        {money(value)}
      </span>
    </div>
  );
}
