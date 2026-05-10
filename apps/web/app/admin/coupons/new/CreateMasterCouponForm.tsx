"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Loader2, Ticket, Globe, Store as StoreIcon, X } from "lucide-react";

type StoreOption = { storeId: number; name: string; ownerName?: string };

// sv-SE locale conveniently formats as ISO YYYY-MM-DD; combined with
// timeZone: Asia/Bangkok this returns the Thai-local calendar date,
// which is what every <input type="date"> consumer expects.
const BKK_DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bangkokDate(d: Date): string {
  return BKK_DATE_FMT.format(d);
}

interface Props {
  stores: StoreOption[];
}

export function CreateMasterCouponForm({ stores }: Props) {
  const router = useRouter();

  // Scope: master = platform-wide, store = single-store coupon. Schema
  // doesn't support multi-store / category / tag scopes today (would
  // need new junction tables); those stay on the post-defense backlog.
  const [scope, setScope] = useState<"master" | "store">("master");
  const [storeId, setStoreId] = useState<number | null>(null);
  const [storeQuery, setStoreQuery] = useState("");
  const [storeOpen, setStoreOpen] = useState(false);
  const storeInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  // Bangkok-local YYYY-MM-DD via Intl.DateTimeFormat. Plain
  // toISOString() returns UTC, so any admin opening the form before
  // 07:00 ICT would see yesterday's date in the start picker.
  const [startDate, setStartDate] = useState(() => bangkokDate(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return bangkokDate(d);
  });
  const [usageLimit, setUsageLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStore = useMemo(
    () => (storeId !== null ? stores.find((s) => s.storeId === storeId) ?? null : null),
    [storeId, stores],
  );

  // Top 8 stores by name match — case-insensitive contains, prefix
  // first then substring. Skip the already-selected one.
  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    const pool = stores.filter((s) => s.storeId !== storeId);
    if (!q) return pool.slice(0, 8);
    return pool
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.ownerName?.toLowerCase().includes(q) ?? false),
      )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [storeQuery, storeId, stores]);

  function pickStore(s: StoreOption) {
    setStoreId(s.storeId);
    setStoreQuery("");
    setStoreOpen(false);
  }

  function clearStore() {
    setStoreId(null);
    setStoreQuery("");
    setTimeout(() => storeInputRef.current?.focus(), 0);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (scope === "store" && storeId === null) {
      setError("Pick a store, or switch the scope to Master.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          discountType,
          discountValue: Number(discountValue),
          startDate,
          endDate,
          usageLimit: Number(usageLimit),
          // Server treats null/missing as master.
          storeId: scope === "store" ? storeId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Couldn't create coupon.");
        setBusy(false);
        return;
      }
      router.push("/admin/coupons");
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-space-900 p-6 space-y-5">
      {/* Scope picker */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-ink-dim mb-2">
          Scope
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setScope("master")}
            className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              scope === "master"
                ? "border-metu-yellow/60 bg-metu-yellow/10"
                : "border-line bg-space-950 hover:border-line/80"
            }`}
          >
            <Globe className={`h-4 w-4 mt-0.5 shrink-0 ${scope === "master" ? "text-metu-yellow" : "text-ink-dim"}`} />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">Master</div>
              <div className="text-[11px] text-ink-dim leading-snug">
                Redeems against any product on any store.
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setScope("store")}
            className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              scope === "store"
                ? "border-metu-yellow/60 bg-metu-yellow/10"
                : "border-line bg-space-950 hover:border-line/80"
            }`}
          >
            <StoreIcon className={`h-4 w-4 mt-0.5 shrink-0 ${scope === "store" ? "text-metu-yellow" : "text-ink-dim"}`} />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">Specific store</div>
              <div className="text-[11px] text-ink-dim leading-snug">
                Locks the coupon to one store&apos;s products only.
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Store picker — only visible in store scope */}
      {scope === "store" && (
        <div className="relative">
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">
            Target store
          </label>
          {selectedStore ? (
            <div className="flex items-center justify-between rounded-xl border border-metu-yellow/40 bg-metu-yellow/5 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{selectedStore.name}</div>
                {selectedStore.ownerName && (
                  <div className="text-[11px] text-ink-dim truncate">{selectedStore.ownerName}</div>
                )}
              </div>
              <button
                type="button"
                onClick={clearStore}
                className="ml-3 rounded-full p-1 text-ink-dim hover:text-white hover:bg-white/10"
                aria-label="Clear store selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <input
                ref={storeInputRef}
                type="text"
                value={storeQuery}
                onChange={(e) => {
                  setStoreQuery(e.target.value);
                  setStoreOpen(true);
                }}
                onFocus={() => setStoreOpen(true)}
                onBlur={() => setTimeout(() => setStoreOpen(false), 150)}
                placeholder={stores.length === 0 ? "No stores available" : "Search by store or owner name…"}
                disabled={stores.length === 0}
                className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white text-sm placeholder:text-zinc-600 focus:border-metu-yellow outline-none disabled:opacity-50"
              />
              {storeOpen && filteredStores.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-line bg-space-950 shadow-xl overflow-hidden">
                  {filteredStores.map((s) => (
                    <button
                      key={s.storeId}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickStore(s);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{s.name}</div>
                        {s.ownerName && (
                          <div className="text-[10px] text-ink-dim truncate">{s.ownerName}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-ink-dim font-mono shrink-0 ml-2">#{s.storeId}</span>
                    </button>
                  ))}
                </div>
              )}
              {storeOpen && storeQuery.trim() && filteredStores.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-line bg-space-950 px-4 py-3 text-xs text-ink-dim">
                  No matching stores.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Code */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">Coupon code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 50))}
          placeholder="WELCOME10"
          required
          className="w-full font-mono rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none uppercase"
        />
      </div>

      {/* Discount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">Discount type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
            className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none"
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (THB)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">
            Discount value {discountType === "percent" ? "(%)" : "(THB)"}
          </label>
          <input
            type="number"
            min={1}
            max={discountType === "percent" ? 100 : undefined}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            required
            className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none"
          />
        </div>
      </div>

      {/* Usage */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">Usage limit (max redemptions)</label>
        <input
          type="number"
          min={1}
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
          required
          className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-coral border border-coral/30 bg-coral/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || !code || !discountValue}
          className="inline-flex items-center gap-2 rounded-full bg-metu-yellow px-5 py-2.5 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {busy ? "Creating…" : scope === "master" ? "Create master coupon" : "Create store coupon"}
        </button>
      </div>
    </form>
  );
}
