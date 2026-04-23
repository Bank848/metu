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

/**
 * Phase 10 / Step 3a — coupon form rebuilt against Step 2 primitives.
 *
 * Two `<FormSection>` blocks (Coupon details / Schedule + limits) plus a
 * sticky `<PreviewPane variant="coupon">` on the right that renders the
 * coral promo pill exactly as buyers will see it. The preview reacts to
 * every keystroke so sellers can sanity-check the code formatting and
 * discount math before submitting.
 */
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
        setError(
          data?.error === "ValidationError"
            ? "Invalid input — code must be UPPERCASE letters/numbers/_/-"
            : data?.message ?? "Failed to create coupon",
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
          accent="mint"
          variant="accent"
        >
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Starts"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <TextInput
              label="Ends"
              type="datetime-local"
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
            {busy ? "Creating…" : "Create coupon →"}
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
