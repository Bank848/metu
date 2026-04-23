"use client";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import { SelectInput } from "./SelectInput";
import { NumberInput } from "./NumberInput";
import { TextInput } from "./TextInput";

/**
 * Phase 10 / Step 2 — semantic variant editor for product forms.
 *
 * Replaces the cramped `grid-cols-4` layout in EditProductForm /
 * NewProductForm with a more legible "delivery method on top, qty +
 * price + discount in a horizontal flex row underneath" structure. The
 * 4-up grid wraps badly on narrow viewports and forces seller to scan
 * left-to-right across labels they can't predict.
 *
 * The "Buyer sees" pill on the right of the row mirrors PriceInput's
 * preview chip so the seller has one consistent place to look for
 * post-discount pricing. We render the pill inside the row (not inside
 * the price input) because it summarises the whole variant — quantity
 * × discount × price — and so wants more horizontal breathing room than
 * a per-input chip can give.
 *
 * Design note: `onChange` returns a `Partial<VariantRowValue>` rather
 * than a full value. The forms that consume this primitive already keep
 * variants in an array and merge with `prev.map((v, idx) => idx === i
 * ? { ...v, ...patch } : v)` — so handing the patch back unchanged is
 * the cheapest possible callsite.
 */
export type DeliveryMethod = "download" | "email" | "license_key" | "streaming";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: "download",    label: "Download" },
  { value: "email",       label: "Email" },
  { value: "license_key", label: "License key" },
  { value: "streaming",   label: "Streaming" },
];

export type VariantRowValue = {
  deliveryMethod: DeliveryMethod;
  quantity: number;
  price: number;
  discountPercent: number;
  discountAmount: number;
  sampleUrl?: string | null;
};

export interface VariantRowProps {
  index: number;
  value: VariantRowValue;
  onChange: (next: Partial<VariantRowValue>) => void;
  onRemove?: () => void;
  /**
   * True when this variant is locked because the API can't drop it
   * (sales history exists). The trash button stays in place so the row
   * layout doesn't shift, but is dimmed and shows a tooltip explaining
   * why it can't be used. Mirrors the EditProductForm pattern.
   */
  isProtected?: boolean;
  /** Whether the remove control should appear at all. */
  removable: boolean;
  className?: string;
}

export function VariantRow({
  index,
  value,
  onChange,
  onRemove,
  isProtected = false,
  removable,
  className,
}: VariantRowProps) {
  const finalPrice = value.price * (1 - value.discountPercent / 100);
  const hasDiscount = value.discountPercent > 0;

  return (
    <div
      className={cn(
        "surface-flat rounded-xl p-4 space-y-3 border transition",
        // Hover gets a mint border accent — signals the row is the
        // current edit target without flashing the whole page yellow.
        "hover:border-mint/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-ink-dim">
              Variant {index + 1}
            </span>
            {isProtected && (
              <span className="text-[10px] uppercase tracking-wider text-mint">
                Live
              </span>
            )}
          </div>
          <SelectInput
            label="Delivery method"
            value={value.deliveryMethod}
            onChange={(e) =>
              onChange({ deliveryMethod: e.target.value as DeliveryMethod })
            }
            options={DELIVERY_OPTIONS}
          />
        </div>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isProtected}
            aria-disabled={isProtected}
            title={
              isProtected
                ? "Cannot delete — has sales history"
                : "Remove variant"
            }
            aria-label={
              isProtected
                ? "Cannot delete — has sales history"
                : "Remove variant"
            }
            className={cn(
              "p-2 rounded-lg transition shrink-0",
              isProtected
                ? "text-ink-dim opacity-40 cursor-not-allowed"
                : "text-ink-dim hover:text-coral hover:bg-coral/10",
            )}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Horizontal flex row of qty + price + discount inputs. Wraps on
          narrow viewports so each input stays comfortably wide rather
          than collapsing to a 4-up grid where labels truncate. */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[120px]">
          <NumberInput
            label="Stock"
            value={value.quantity}
            min={0}
            step={1}
            onChange={(e) =>
              onChange({ quantity: Math.max(0, Number(e.target.value)) })
            }
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <NumberInput
            label="Price (฿)"
            value={value.price}
            min={0}
            step={1}
            onChange={(e) => {
              const next = Math.max(0, Number(e.target.value));
              onChange({
                price: next,
                discountAmount: (next * value.discountPercent) / 100,
              });
            }}
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <NumberInput
            label="Discount %"
            value={value.discountPercent}
            min={0}
            max={100}
            step={1}
            onChange={(e) => {
              const next = Math.min(100, Math.max(0, Number(e.target.value)));
              onChange({
                discountPercent: next,
                discountAmount: (value.price * next) / 100,
              });
            }}
          />
        </div>
        {/* Buyer sees pill — full-height align so it doesn't sink under
            the inputs. Mirrors PriceInput's mint/coral pill colours. */}
        <div className="flex items-end pb-1">
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap",
              hasDiscount
                ? "bg-coral/15 text-coral border border-coral/30"
                : "bg-mint/15 text-mint border border-mint/30",
            )}
            aria-live="polite"
          >
            Buyer sees: {money(finalPrice)}
            {hasDiscount && (
              <span className="ml-1.5 line-through text-coral/60 font-normal">
                {money(value.price)}
              </span>
            )}
          </span>
        </div>
      </div>

      <TextInput
        label="Free sample URL"
        helperText="Optional — link to a low-res preview / sample"
        type="url"
        value={value.sampleUrl ?? ""}
        onChange={(e) => onChange({ sampleUrl: e.target.value || null })}
        placeholder="https://…"
      />
    </div>
  );
}
