"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";

export function CreateMasterCouponForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [usageLimit, setUsageLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
    <form onSubmit={submit} className="rounded-2xl border border-line bg-space-900 p-6 space-y-4">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">Discount type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
            className="w-full rounded-xl border border-line bg-space-950 px-4 py-2 text-white focus:border-metu-yellow outline-none"
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (฿)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">
            Discount value {discountType === "percent" ? "(%)" : "(฿)"}
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
          {busy ? "Creating…" : "Create master coupon"}
        </button>
      </div>
    </form>
  );
}
