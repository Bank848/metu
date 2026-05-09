"use client";
import { Trash2, ChevronDown, ChevronUp, Infinity, Hash } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { coins, thbToCoins } from "@/lib/format";
import { SelectInput } from "./SelectInput";
import { NumberInput } from "./NumberInput";
import { TextInput } from "./TextInput";
import { TextareaInput } from "./TextareaInput";
import { FileImageInput } from "@/components/FileImageInput";

export type DeliveryMethod = "download" | "email" | "license_key" | "streaming";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: "download",    label: "Download" },
  { value: "email",       label: "Email" },
  { value: "license_key", label: "License key" },
  { value: "streaming",   label: "Streaming" },
];

export type VariantRowValue = {
  name: string;
  description?: string;
  image?: string;
  deliveryMethod: DeliveryMethod;
  quantity?: number;
  price: number;
  discountPercent: number;
  discountAmount: number;
  deliveryUrl?: string | null;
  licenseKeyTemplate?: string | null;
};

export interface VariantRowProps {
  index: number;
  value: VariantRowValue;
  onChange: (next: Partial<VariantRowValue>) => void;
  onRemove?: () => void;
  isProtected?: boolean;
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
  const [expanded, setExpanded] = useState(true);
  const finalPrice = value.price * (1 - value.discountPercent / 100);
  const hasDiscount = value.discountPercent > 0;

  return (
    <div className={cn(
      "surface-flat rounded-xl border transition",
      className,
    )}>

      {/* ── Header row (always visible) ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Variant image thumbnail */}
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
          {value.image ? (
            <img src={value.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-dim text-[10px] font-mono">
              {index + 1}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {value.name || `Variant ${index + 1}`}
          </p>
          <p className="text-[11px] text-ink-dim truncate">
            {value.deliveryMethod} · ฿{finalPrice.toLocaleString()}
            {hasDiscount && (
              <span className="ml-1 text-coral">−{value.discountPercent}%</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {removable && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isProtected}
              title={isProtected ? "Cannot delete — has sales history" : "Remove variant"}
              className={cn(
                "p-1.5 rounded-lg transition",
                isProtected
                  ? "text-ink-dim opacity-40 cursor-not-allowed"
                  : "text-ink-dim hover:text-coral hover:bg-coral/10",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-ink-dim hover:text-white hover:bg-white/5 transition"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/6 pt-4">

          {/* Image + Name + Description */}
          <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
            <FileImageInput
              label="Variant image"
              helperText="800 × 800 recommended"
              value={value.image ?? ""}
              onChange={(v) => onChange({ image: v })}
              aspect="square"
            />
            <div className="space-y-3">
              <TextInput
                label="Variant name"
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g. Standard License, HD Pack, Full Bundle"
              />
              <TextareaInput
                label="Description"
                value={value.description ?? ""}
                onChange={(e) => onChange({ description: e.target.value.slice(0, 140) })}
                rows={2}
                placeholder="What's included in this variant?"
                helperText={`${(value.description ?? "").length} / 140`}
              />
            </div>
          </div>

          {/* Delivery + Pricing row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <SelectInput
              label="Delivery"
              value={value.deliveryMethod}
              onChange={(e) => onChange({ deliveryMethod: e.target.value as DeliveryMethod })}
              options={DELIVERY_OPTIONS}
            />
            <div className="flex-1 min-w-[120px]">
            <NumberInput
              label="Stock"
              value={value.quantity ?? ""}
              min={0}
              step={1}
              disabled={value.quantity == null}
              placeholder="∞"
              onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value)) })}
              rightSlot={
                <button
                  type="button"
                  title={value.quantity == null ? "Unlimited stock | Click to set a limit" : "Limited stock | Click for unlimited"}
                  onClick={() => onChange({ quantity: value.quantity == null ? 1 : undefined })}
                  className={cn(
                    "h-full px-2.5 border-l transition-colors",
                    value.quantity == null
                      ? "border-white/10 text-metu-yellow hover:text-white hover:bg-white/5"
                      : "border-white/10 text-ink-dim hover:text-coral hover:bg-coral/5",
                  )}
                >
                  {value.quantity == null ? (
                    <Infinity className="h-3.5 w-3.5" />
                  ) : (
                    <Hash className="h-3.5 w-3.5" />
                  )}
                </button>
              }
            />
          </div>
            <NumberInput
              label="Price (฿)"
              value={value.price}
              min={0}
              step={1}
              onChange={(e) => {
                const next = Math.max(0, Number(e.target.value));
                onChange({ price: next, discountAmount: (next * value.discountPercent) / 100 });
              }}
            />
            <NumberInput
              label="Discount %"
              value={value.discountPercent}
              min={0}
              max={100}
              step={1}
              onChange={(e) => {
                const next = Math.min(100, Math.max(0, Number(e.target.value)));
                onChange({ discountPercent: next, discountAmount: (value.price * next) / 100 });
              }}
            />
          </div>

          {/* Buyer price badge */}
          <span className={cn(
            "inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold",
            hasDiscount
              ? "text-coral border border-coral/30"
              : "text-mint",
          )}>
            Buyer sees: {coins(thbToCoins(finalPrice))}
            {hasDiscount && (
              <span className="ml-1.5 line-through text-coral/60 font-normal">
                {coins(thbToCoins(value.price))}
              </span>
            )}
          </span>

          {/* Delivery URL */}
          {(value.deliveryMethod === "download" || value.deliveryMethod === "streaming") && (
            <TextInput
              label="Delivery URL"
              helperText="Private — sent to buyer after payment only."
              type="url"
              value={value.deliveryUrl ?? ""}
              onChange={(e) => onChange({ deliveryUrl: e.target.value || null })}
              placeholder="https://…"
            />
          )}

          {/* License key template */}
          {(value.deliveryMethod === "license_key" || value.deliveryMethod === "email") && (
            <TextInput
              label="License key template"
              helperText="Use XXXX for random chars. e.g. METU-XXXX-XXXX-XXXX. Leave blank for a random UUID."
              type="text"
              value={value.licenseKeyTemplate ?? ""}
              onChange={(e) => onChange({ licenseKeyTemplate: e.target.value || null })}
              placeholder="METU-XXXX-XXXX-XXXX"
            />
          )}
        </div>
      )}
    </div>
  );
}