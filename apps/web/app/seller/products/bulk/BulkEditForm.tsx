"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, AlertTriangle } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = {
  productItemId: number;
  productId: number;
  productName: string;
  isActive: boolean;
  deliveryMethod: string;
  quantity: number;
  discountPercent: number;
  price: number;
};

/**
 * Bulk price editor. Pick rows, type a percentage (positive = increase,
 * negative = discount), confirm — all selected variants get patched in
 * parallel via PATCH /api/seller/product-items/[id].
 */
export function BulkEditForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [percent, setPercent] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { ok: number; fail: number }>(null);
  // Phase 11 / F19 — open the in-page confirm modal before fanning out
  // the price patch. Keeps the seller from blowing past native dialogs
  // (which Chrome MCP locks on, per QA F19).
  const [confirmApply, setConfirmApply] = useState(false);

  const selectedItems = items.filter((it) => selected[it.productItemId]);
  const pct = Number(percent);
  const validPct = Number.isFinite(pct) && pct !== 0 && pct >= -90 && pct <= 500;

  function toggleAll(on: boolean) {
    setSelected(on ? Object.fromEntries(items.map((it) => [it.productItemId, true])) : {});
  }

  function onSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!validPct || selectedItems.length === 0) return;
    setConfirmApply(true);
  }

  async function apply() {
    setConfirmApply(false);
    setBusy(true);
    setResult(null);

    let ok = 0;
    let fail = 0;
    await Promise.all(
      selectedItems.map(async (it) => {
        const newPrice = Math.round(it.price * (1 + pct / 100) * 100) / 100;
        if (newPrice < 0) {
          fail += 1;
          return;
        }
        try {
          const res = await fetch(`/api/seller/product-items/${it.productItemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ price: newPrice }),
          });
          if (res.ok) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      }),
    );
    setResult({ ok, fail });
    setBusy(false);
    setSelected({});
    setPercent("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <form
        onSubmit={onSubmitForm}
        className="rounded-2xl glass-morphism p-5 flex flex-wrap items-end gap-4"
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
            Adjust by %
          </span>
          <input
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="e.g. 10 or -25"
            min={-90}
            max={500}
            step={0.5}
            className="mt-1 w-40 rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-white outline-none focus:border-metu-yellow"
          />
          <p className="mt-1 text-[10px] text-ink-dim">
            Positive = increase · negative = discount · −90 to +500
          </p>
        </label>

        <div className="text-sm text-ink-secondary self-center">
          {selectedItems.length} selected
        </div>

        <div className="ml-auto flex items-center gap-2">
          <GlassButton
            tone="glass"
            size="sm"
            type="button"
            onClick={() => toggleAll(true)}
            disabled={busy}
          >
            Select all
          </GlassButton>
          <GlassButton
            tone="glass"
            size="sm"
            type="button"
            onClick={() => toggleAll(false)}
            disabled={busy}
          >
            Clear
          </GlassButton>
          <GlassButton tone="gold" size="md" type="submit" disabled={busy || !validPct || selectedItems.length === 0}>
            <Save className="h-4 w-4" />
            {busy ? "Applying…" : "Apply change"}
          </GlassButton>
        </div>

        {result && (
          <p className={cn("w-full text-sm", result.fail === 0 ? "text-green-400" : "text-amber-400")}>
            {result.ok} updated · {result.fail} failed
          </p>
        )}
        {!validPct && percent && (
          <p className="w-full text-xs text-amber-400 inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Enter a non-zero percentage between −90 and +500.
          </p>
        )}
      </form>

      {/* Table */}
      <div className="rounded-2xl glass-morphism overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-dim bg-white/[0.02]">
            <tr>
              <th className="px-3 py-3 w-10"></th>
              <th className="text-left px-3 py-3">Product</th>
              <th className="text-left px-3 py-3">Delivery</th>
              <th className="text-right px-3 py-3">Stock</th>
              <th className="text-right px-3 py-3">Discount</th>
              <th className="text-right px-3 py-3">Current price</th>
              <th className="text-right px-3 py-3">After change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {items.map((it) => {
              const isSelected = !!selected[it.productItemId];
              const newPrice = validPct ? Math.round(it.price * (1 + pct / 100) * 100) / 100 : it.price;
              return (
                <tr key={it.productItemId} className={cn(!it.isActive && "opacity-60")}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [it.productItemId]: e.target.checked }))
                      }
                      className="h-4 w-4 accent-metu-yellow cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3 text-white truncate max-w-[280px]">
                    {it.productName}
                    {!it.isActive && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300">
                        Paused
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 capitalize text-ink-secondary">
                    {it.deliveryMethod.replace("_", " ")}
                  </td>
                  <td className="px-3 py-3 text-right text-ink-secondary">{it.quantity}</td>
                  <td className="px-3 py-3 text-right text-ink-secondary">{it.discountPercent}%</td>
                  <td className="px-3 py-3 text-right">{money(it.price)}</td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right font-semibold",
                      isSelected && validPct
                        ? newPrice > it.price
                          ? "text-amber-300"
                          : "text-green-400"
                        : "text-ink-dim",
                    )}
                  >
                    {money(newPrice)}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-dim">
                  No variants yet. Add a product first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirmApply}
        title="Apply price change?"
        body={`Adjust ${selectedItems.length} variant${selectedItems.length === 1 ? "" : "s"} by ${pct > 0 ? "+" : ""}${pct}%. This updates the catalogue price immediately for buyers.`}
        confirmLabel="Apply change"
        // Bulk price changes are reversible (the seller can re-apply
        // an inverse percentage), so this stays on the default tone
        // rather than the destructive coral.
        tone="default"
        onConfirm={apply}
        onCancel={() => setConfirmApply(false)}
      />
    </div>
  );
}
