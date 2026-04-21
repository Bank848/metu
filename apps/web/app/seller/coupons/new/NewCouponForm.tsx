"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ticket } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewCouponForm() {
  const router = useRouter();
  const now = new Date();
  const monthAhead = new Date(now.getTime() + 30 * 86_400_000);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(10);
  const [usageLimit, setUsageLimit] = useState(100);
  const [startDate, setStartDate] = useState(isoLocal(now));
  const [endDate, setEndDate] = useState(isoLocal(monthAhead));
  const [isActive, setIsActive] = useState(true);

  const inputCls = "w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/seller/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType,
          discountValue,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          usageLimit,
          isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error === "ValidationError" ? "Invalid input — code must be UPPERCASE letters/numbers/_/-" : data?.message ?? "Failed to create coupon");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/seller/coupons");
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-2xl">
      <section className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Ticket className="h-4 w-4 text-metu-yellow" />
          Coupon details
        </h2>

        <label className="block">
          <span className="text-sm font-semibold text-white">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            minLength={3}
            maxLength={50}
            placeholder="Pick a memorable code"
            pattern="[A-Z0-9_-]+"
            className={`mt-1 ${inputCls} font-mono`}
          />
          <p className="text-[10px] text-ink-dim mt-1">UPPERCASE letters, numbers, underscore, dash only.</p>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-semibold text-white">Discount type</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
              className={`mt-1 ${inputCls}`}
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off (THB)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white">
              Value {discountType === "percent" ? "(%)" : "(฿)"}
            </span>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(Math.max(1, Number(e.target.value)))}
              min={1}
              max={discountType === "percent" ? 100 : 100000}
              required
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-semibold text-white">Starts</span>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white">Ends</span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-white">Usage limit</span>
          <input
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(Math.max(1, Number(e.target.value)))}
            min={1}
            required
            className={`mt-1 ${inputCls}`}
          />
          <p className="text-[10px] text-ink-dim mt-1">Total redemptions across all customers.</p>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-surface-3 text-metu-yellow focus:ring-metu-yellow focus:ring-offset-surface-1"
          />
          <span className="text-sm text-white">Active immediately</span>
        </label>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 justify-end">
        <GlassButton tone="glass" size="lg" href="/seller/coupons">Cancel</GlassButton>
        <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create coupon →"}
        </GlassButton>
      </div>
    </form>
  );
}
