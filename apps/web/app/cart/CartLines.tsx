"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Tag as TagIcon, ShieldCheck, Sparkles, ShoppingBag, AlertTriangle, Heart } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { money } from "@/lib/format";
import { play } from "@/lib/sound";
import { cn, isDataUrl } from "@/lib/utils";

type Line = {
  cartItemId: number;
  productItemId: number;
  productId: number;
  productName: string;
  storeId: number;
  storeName: string;
  image: string | null;
  deliveryMethod: string;
  stock: number;
  unitPrice: number;
  basePrice: number;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
};

type Cart = { cartId: number; subtotal: number; items: Line[] };

type CouponResult =
  | null
  | {
      valid: false;
      reason?: string;
    }
  | {
      valid: true;
      code: string;
      couponId: number;
      discountType: "percent" | "fixed";
      discountValue: number;
      store: { storeId: number; name: string };
    };

const API = "/api";
const DIGITAL = new Set(["download", "email", "license_key", "streaming"]);

function maxForLine(line: Line): number {
  return DIGITAL.has(line.deliveryMethod) ? 1 : Math.max(1, line.stock);
}

export function CartLines({ cart: initial }: { cart: Cart }) {
  const router = useRouter();
  const [cart, setCart] = useState(initial);
  const [coupon, setCoupon] = useState("");
  const [couponFocused, setCouponFocused] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponResult>(null);
  const [busy, setBusy] = useState(false);
  const [lineError, setLineError] = useState<Record<number, string>>({});

  // Every item is selected by default. Checkbox state survives qty / remove
  // as long as the item is still in the cart.
  const [selected, setSelected] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(initial.items.map((l) => [l.cartItemId, true])),
  );
  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const l of cart.items) if (next[l.cartItemId] === undefined) next[l.cartItemId] = true;
      for (const id of Object.keys(next)) {
        if (!cart.items.find((l) => String(l.cartItemId) === id)) delete next[id as unknown as number];
      }
      return next;
    });
  }, [cart.items]);

  const selectedItems = useMemo(
    () => cart.items.filter((l) => selected[l.cartItemId]),
    [cart.items, selected],
  );
  const selectedCount = selectedItems.reduce((a, b) => a + b.quantity, 0);

  const subtotal = useMemo(
    () => selectedItems.reduce((a, b) => a + b.lineTotal, 0),
    [selectedItems],
  );

  // Discount is scoped to the coupon's store — only lines from that store
  // count toward the eligible subtotal the discount applies to.
  const eligibleSubtotal = useMemo(() => {
    if (!couponResult?.valid) return 0;
    return selectedItems
      .filter((l) => l.storeId === couponResult.store.storeId)
      .reduce((a, b) => a + b.lineTotal, 0);
  }, [couponResult, selectedItems]);

  const discount = useMemo(() => {
    if (!couponResult?.valid || eligibleSubtotal <= 0) return 0;
    if (couponResult.discountType === "percent") {
      return (eligibleSubtotal * couponResult.discountValue) / 100;
    }
    return Math.min(eligibleSubtotal, couponResult.discountValue);
  }, [couponResult, eligibleSubtotal]);

  const total = Math.max(0, subtotal - discount);

  async function updateQty(cartItemId: number, quantity: number) {
    setLineError((p) => ({ ...p, [cartItemId]: "" }));
    const res = await fetch(`${API}/cart/items/${cartItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLineError((p) => ({ ...p, [cartItemId]: data?.message ?? "Can't update quantity" }));
      return;
    }
    setCart({
      ...cart,
      items: cart.items.map((l) =>
        l.cartItemId === cartItemId ? { ...l, quantity, lineTotal: l.unitPrice * quantity } : l,
      ),
    });
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

  /** Save for later: heart the product, then drop it from the cart in
   *  one click. The favourite POST is idempotent so a no-op is safe. */
  async function saveForLater(line: Line) {
    try {
      await fetch(`${API}/favorites/${line.productId}`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* swallow — proceed to remove either way */
    }
    await remove(line.cartItemId);
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
    if (selectedItems.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: couponResult?.valid ? couponResult.code : undefined,
          // Only send the chosen line IDs — unchecked items stay in the
          // next active cart.
          selectedCartItemIds: selectedItems.map((l) => l.cartItemId),
        }),
        credentials: "include",
      });
      if (!res.ok) {
        play("error");
        setBusy(false);
        return;
      }
      const data = await res.json();
      play("success");
      router.push(`/orders/${data.orderId}?new=1`);
    } catch {
      play("error");
      setBusy(false);
    }
  }

  // Group by store (Map preserves insertion order)
  const byStore = new Map<number, { name: string; lines: Line[] }>();
  for (const l of cart.items) {
    const slot = byStore.get(l.storeId) ?? { name: l.storeName, lines: [] };
    slot.lines.push(l);
    byStore.set(l.storeId, slot);
  }

  const couponNoMatch =
    couponResult?.valid &&
    eligibleSubtotal === 0 &&
    !selectedItems.some((l) => l.storeId === couponResult.store.storeId);

  return (
    <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
      {/* ───── Lines ───── */}
      <div className="space-y-6">
        {[...byStore.entries()].map(([storeId, { name: storeName, lines }]) => {
          const allChecked = lines.every((l) => selected[l.cartItemId]);
          const someChecked = lines.some((l) => selected[l.cartItemId]);
          const storeSubtotal = lines
            .filter((l) => selected[l.cartItemId])
            .reduce((a, b) => a + b.lineTotal, 0);
          const couponAppliesHere = couponResult?.valid && couponResult.store.storeId === storeId;
          const storeDiscount = couponAppliesHere
            ? couponResult.discountType === "percent"
              ? (storeSubtotal * couponResult.discountValue) / 100
              : Math.min(storeSubtotal, couponResult.discountValue)
            : 0;
          return (
            <section key={storeId} className="rounded-2xl glass-morphism overflow-hidden">
              {/* store header with select-all + gold rule */}
              <div className="px-5 py-3 flex items-center gap-3 border-b border-white/8 bg-gradient-to-r from-metu-yellow/8 via-transparent to-transparent">
                <input
                  type="checkbox"
                  checked={allChecked}
                  // indeterminate via ref would be ideal; CSS-only hint instead
                  onChange={(e) => {
                    const val = e.target.checked;
                    setSelected((prev) => {
                      const next = { ...prev };
                      for (const l of lines) next[l.cartItemId] = val;
                      return next;
                    });
                  }}
                  aria-label={`Select all items from ${storeName}`}
                  className="h-4 w-4 accent-metu-yellow cursor-pointer"
                  data-indeterminate={!allChecked && someChecked}
                />
                <ShieldCheck className="h-3.5 w-3.5 text-metu-yellow" />
                <Link
                  href={`/store/${storeId}`}
                  className="text-sm font-semibold text-white hover:text-metu-yellow"
                >
                  {storeName}
                </Link>
                {couponAppliesHere && (
                  <span className="ml-auto text-[10px] font-semibold text-green-400 inline-flex items-center gap-1">
                    <TagIcon className="h-3 w-3" />
                    {couponResult.code} active
                  </span>
                )}
              </div>

              <ul className="divide-y divide-white/6">
                {lines.map((l) => {
                  const isChecked = !!selected[l.cartItemId];
                  const max = maxForLine(l);
                  const isDigital = DIGITAL.has(l.deliveryMethod);
                  const err = lineError[l.cartItemId];
                  return (
                    <li key={l.cartItemId} className={cn("flex items-center gap-4 p-4 transition", !isChecked && "opacity-55")}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [l.cartItemId]: e.target.checked }))
                        }
                        aria-label={`Select ${l.productName}`}
                        className="h-4 w-4 accent-metu-yellow cursor-pointer shrink-0"
                      />
                      <Link
                        href={`/product/${l.productId}`}
                        className="relative h-20 w-20 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8 hover:border-metu-yellow/40 transition"
                      >
                        {l.image && (
                          <Image src={l.image} alt="" fill sizes="80px" className="object-cover" unoptimized={isDataUrl(l.image)} />
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/product/${l.productId}`}
                          className="font-semibold text-white hover:text-metu-yellow line-clamp-1"
                        >
                          {l.productName}
                        </Link>
                        <div className="text-xs text-ink-dim capitalize mt-0.5 inline-flex items-center gap-2">
                          <span>{l.deliveryMethod.replace("_", " ")}</span>
                          {l.discountPercent > 0 && (
                            <span className="text-metu-yellow font-semibold">−{l.discountPercent}%</span>
                          )}
                          {!isDigital && l.stock > 0 && l.stock <= 5 && (
                            <span className="text-amber-400 font-semibold">Only {l.stock} left</span>
                          )}
                          {isDigital && <span className="text-ink-dim/80">· single-use</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center border border-white/10 rounded-full overflow-hidden bg-surface-2">
                            <button
                              type="button"
                              onClick={() => updateQty(l.cartItemId, Math.max(1, l.quantity - 1))}
                              disabled={isDigital || l.quantity <= 1}
                              className="px-2 py-1 text-white hover:bg-white/5 disabled:opacity-30"
                              aria-label="Decrease"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={max}
                              value={l.quantity}
                              disabled={isDigital}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (!Number.isFinite(n) || n < 1) return;
                                updateQty(l.cartItemId, Math.min(max, Math.max(1, Math.floor(n))));
                              }}
                              className="w-12 bg-transparent text-center text-sm font-semibold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:text-ink-dim"
                              aria-label="Quantity"
                            />
                            <button
                              type="button"
                              onClick={() => updateQty(l.cartItemId, Math.min(max, l.quantity + 1))}
                              disabled={isDigital || l.quantity >= max}
                              className="px-2 py-1 text-white hover:bg-white/5 disabled:opacity-30"
                              aria-label="Increase"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => saveForLater(l)}
                            className="text-ink-dim hover:text-metu-red transition"
                            aria-label="Save for later"
                            title="Move to favourites"
                          >
                            <Heart className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(l.cartItemId)}
                            className="text-ink-dim hover:text-metu-red transition"
                            aria-label="Remove"
                            title="Remove from cart"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {err && (
                          <p className="mt-1 text-[11px] text-amber-400 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {err}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="font-display text-lg font-bold text-gold-gradient">
                          {money(l.lineTotal)}
                        </div>
                        <div className="text-xs text-ink-dim">{money(l.unitPrice)} ea</div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* per-store summary strip when coupon applies OR for clarity */}
              {storeSubtotal > 0 && (
                <div className="px-5 py-3 border-t border-white/6 flex items-center justify-between text-xs text-ink-secondary">
                  <span>
                    Store subtotal{" "}
                    <span className="text-white font-semibold">{money(storeSubtotal)}</span>
                  </span>
                  {storeDiscount > 0 && (
                    <span className="text-green-400 font-semibold">
                      −{money(storeDiscount)} with {couponResult?.valid ? couponResult.code : ""}
                    </span>
                  )}
                </div>
              )}
            </section>
          );
        })}
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
          {couponResult?.valid && (
            <p className="text-xs flex items-center gap-1 text-green-400">
              <TagIcon className="h-3 w-3" />
              <span>
                <strong>{couponResult.code}</strong> applied ·{" "}
                {couponResult.discountType === "percent"
                  ? `−${couponResult.discountValue}%`
                  : `−${money(couponResult.discountValue)}`}
                {" · "}
                <span className="text-ink-secondary">{couponResult.store.name} items only</span>
              </span>
            </p>
          )}
          {couponResult && !couponResult.valid && (
            <p className="text-xs text-red-400">{couponResult.reason}</p>
          )}
          {couponNoMatch && (
            <p className="text-xs text-amber-400 inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              No selected items are from {couponResult?.valid ? couponResult.store.name : ""}.
            </p>
          )}
        </form>

        {/* Money rows */}
        <div className="space-y-1.5 text-sm mb-4">
          <Row
            label={`Subtotal (${selectedCount} item${selectedCount !== 1 ? "s" : ""})`}
            value={subtotal}
          />
          {discount > 0 && <Row label="Discount" value={-discount} accent="green" />}
          <div className="border-t border-white/8 my-3" />
          <div className="flex justify-between items-baseline">
            <span className="text-white font-semibold">Total</span>
            <span className="font-display text-2xl font-extrabold text-gold-gradient">
              {money(total)}
            </span>
          </div>
          {selectedItems.length < cart.items.length && (
            <p className="text-[11px] text-ink-dim pt-1">
              {cart.items.length - selectedItems.length} item(s) will stay in your cart.
            </p>
          )}
        </div>

        <GlassButton
          tone="gold"
          size="lg"
          fullWidth
          onClick={checkout}
          disabled={selectedItems.length === 0 || busy}
        >
          <ShoppingBag className="h-4 w-4" />
          {busy ? "Processing…" : selectedItems.length === 0 ? "Select items to buy" : `Checkout (${selectedItems.length}) →`}
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
