"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";

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
  const [couponResult, setCouponResult] = useState<null | { valid: boolean; code?: string; reason?: string; discountType?: string; discountValue?: number }>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = cart.items.reduce((a, b) => a + b.lineTotal, 0);
  const discount = (() => {
    if (!couponResult?.valid) return 0;
    if (couponResult.discountType === "percent") return (subtotal * (couponResult.discountValue ?? 0)) / 100;
    return Math.min(subtotal, couponResult.discountValue ?? 0);
  })();
  const total = Math.max(0, subtotal - discount);

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
      <div className="space-y-6">
        {[...byStore.entries()].map(([store, lines]) => (
          <section key={store} className="rounded-2xl border border-line bg-space-850 overflow-hidden">
            <div className="px-5 py-3 bg-space-800 text-sm font-semibold text-ink-secondary border-b border-line">
              {store}
            </div>
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.cartItemId} className="flex items-center gap-4 p-4">
                  <div className="relative h-20 w-20 rounded-xl bg-space-900 overflow-hidden shrink-0 border border-line">
                    {l.image && <Image src={l.image} alt="" fill sizes="80px" className="object-cover" unoptimized />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${l.productId}`} className="font-semibold text-white hover:text-brand-yellow">
                      {l.productName}
                    </Link>
                    <div className="text-xs text-ink-dim capitalize">
                      {l.deliveryMethod.replace("_", " ")}
                      {l.discountPercent > 0 && (
                        <span className="ml-2 text-brand-yellow font-semibold">
                          −{l.discountPercent}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-line rounded-full overflow-hidden bg-space-900">
                        <button type="button" onClick={() => updateQty(l.cartItemId, Math.max(1, l.quantity - 1))} className="px-2 py-1 text-white hover:bg-white/5">−</button>
                        <span className="px-3 text-sm font-semibold text-white">{l.quantity}</span>
                        <button type="button" onClick={() => updateQty(l.cartItemId, l.quantity + 1)} className="px-2 py-1 text-white hover:bg-white/5">+</button>
                      </div>
                      <button type="button" onClick={() => remove(l.cartItemId)} className="text-ink-dim hover:text-red-400" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-bold text-brand-yellow">{money(l.lineTotal)}</div>
                    <div className="text-xs text-ink-dim">{money(l.unitPrice)} ea</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="rounded-2xl border border-line bg-space-850 p-6 sticky top-28">
        <h2 className="font-display text-lg font-bold text-white mb-4">Order summary</h2>

        <form onSubmit={applyCoupon} className="space-y-2 mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-dim">
            Coupon code
          </label>
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="e.g. METU10"
              className="flex-1 rounded-full border border-line bg-space-900 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none"
            />
            <button
              type="submit"
              disabled={!coupon || busy}
              className="rounded-full border border-line px-4 text-sm font-semibold text-white hover:border-brand-yellow/50 hover:text-brand-yellow disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          {couponResult && (
            <p className={`text-xs ${couponResult.valid ? "text-green-400" : "text-red-400"}`}>
              {couponResult.valid ? (
                <>
                  <TagIcon className="inline h-3 w-3 mr-1" />
                  {couponResult.code} applied · −{couponResult.discountValue}
                  {couponResult.discountType === "percent" ? "%" : " off"}
                </>
              ) : (
                couponResult.reason
              )}
            </p>
          )}
        </form>

        <div className="space-y-1 text-sm mb-4">
          <Row label="Subtotal" value={subtotal} />
          {discount > 0 && <Row label="Discount" value={-discount} />}
          <div className="border-t border-line my-3" />
          <div className="flex justify-between font-display text-xl font-extrabold">
            <span className="text-white">Total</span>
            <span className="text-brand-yellow">{money(total)}</span>
          </div>
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={checkout} disabled={cart.items.length === 0 || busy}>
          {busy ? "Processing…" : "Checkout →"}
        </Button>
        <p className="mt-3 text-[11px] text-ink-dim text-center">
          Demo checkout — no real payment will be processed.
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold text-white">{money(value)}</span>
    </div>
  );
}
