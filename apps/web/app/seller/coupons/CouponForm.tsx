"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FormSection } from "@/components/forms/FormSection";
import { TextInput } from "@/components/forms/TextInput";
import { NumberInput } from "@/components/forms/NumberInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { PreviewPane } from "@/components/forms/PreviewPane";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type CouponFormInitial = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  isActive: boolean;
};

export function CouponForm({
  mode,
  couponId,
  initial,
}: {
  mode: "new" | "edit";
  couponId?: number;
  initial?: CouponFormInitial;
}) {
  const router = useRouter();
  const now = new Date();
  const monthAhead = new Date(now.getTime() + 30 * 86_400_000);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(initial?.code ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(initial?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 10);
  const [usageLimit, setUsageLimit] = useState(initial?.usageLimit ?? 100);
  const [startDate, setStartDate] = useState(initial?.startDate ?? isoLocal(now));
  const [endDate, setEndDate] = useState(initial?.endDate ?? isoLocal(monthAhead));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const url = mode === "edit"
        ? `/api/seller/coupons/${couponId}`
        : "/api/seller/coupons";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
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
        setError(
          data?.error === "ValidationError"
            ? "Invalid input — code must be UPPERCASE letters/numbers/_/-"
            : data?.message ?? `Failed to ${mode === "edit" ? "update" : "create"} coupon`,
        );
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

  const submitLabel = busy
    ? (mode === "edit" ? "Saving…" : "Creating…")
    : (mode === "edit" ? "Save changes →" : "Create coupon →");

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6 min-w-0">
        <FormSection title="Coupon details" description="The code shoppers type at checkout and what it takes off.">
          <TextInput
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            minLength={3}
            maxLength={50}
            placeholder="Pick a memorable code"
            pattern="[A-Z0-9_-]+"
            className="font-mono"
            helperText="UPPERCASE letters, numbers, underscore, dash only."
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Discount type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
              options={[
                { value: "percent", label: "Percent off" },
                { value: "fixed", label: "Fixed amount off (THB)" },
              ]}
            />
            <NumberInput
              label={`Value ${discountType === "percent" ? "(%)" : "(฿)"}`}
              value={discountValue}
              onChange={(e) => setDiscountValue(Math.max(1, Number(e.target.value)))}
              min={1}
              max={discountType === "percent" ? 100 : 100000}
              required
            />
          </div>
        </FormSection>

        <FormSection
          title="Schedule + limits"
          description="When the code is valid and how many redemptions it allows."
          variant="accent"
        >
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Starts"
              type="datetime-local"
              min={mode === "edit" ? undefined : isoLocal(now)}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <TextInput
              label="Ends"
              type="datetime-local"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <NumberInput
            label="Usage limit"
            value={usageLimit}
            onChange={(e) => setUsageLimit(Math.max(1, Number(e.target.value)))}
            min={1}
            required
            helperText="Total redemptions across all customers."
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-surface-3 text-mint focus:ring-mint focus:ring-offset-surface-1"
            />
            <span className="text-sm text-white">Active immediately</span>
          </label>
        </FormSection>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-3 justify-end">
          <GlassButton tone="glass" size="lg" href="/seller/coupons">Cancel</GlassButton>
          <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
            {submitLabel}
          </GlassButton>
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <PreviewPane
          variant="coupon"
          state={{
            code,
            discountPercent: discountType === "percent" ? discountValue : undefined,
            discountAmount: discountType === "fixed" ? discountValue : undefined,
            expiresAt: endDate || null,
          }}
        />
      </div>
    </form>
  );
}
