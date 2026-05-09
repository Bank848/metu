import { forwardRef, type InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";
import { coinsOrFree, thbToCoins } from "@/lib/format";

/**
 * Currency-aware NumberInput. Adds a "Buyer sees: ฿XXX" preview pill
 * inside the field that updates live (handy for discount entry). Only
 * THB renders a symbol; other codes fall through to the code itself.
 */
export interface PriceInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  helperText?: string;
  error?: string;
  /** ISO currency code. Defaults to THB. Currently only THB renders with a symbol. */
  currency?: string;
  /** When set, the preview shows the post-discount price + "after Y% off". */
  discountPercent?: number;
  /** Allow callers to control the input value as a number (preferred) or string. */
  value?: number | string;
}

export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  (
    {
      label,
      helperText,
      error,
      className,
      id,
      currency = "THB",
      discountPercent,
      value,
      min = 0,
      step = 1,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const hasError = Boolean(error);

    const numeric = typeof value === "string" ? Number(value) : (value ?? 0);
    const safe = Number.isFinite(numeric) ? numeric : 0;
    const hasDiscount =
      typeof discountPercent === "number" && discountPercent > 0 && discountPercent <= 100;
    const finalPrice = hasDiscount ? safe * (1 - discountPercent! / 100) : safe;

    const previewText =
      currency === "THB"
        ? hasDiscount
          ? `Buyer sees: ${coinsOrFree(thbToCoins(finalPrice))} after ${discountPercent}% off`
          : `Buyer sees: ${coinsOrFree(thbToCoins(finalPrice))}`
        : hasDiscount
          ? `${currency} ${finalPrice.toFixed(2)} after ${discountPercent}% off`
          : `${currency} ${finalPrice.toFixed(2)}`;

    return (
      <div className="block">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-white mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="number"
            min={min}
            step={step}
            value={value as number | string | undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-help`
                  : `${inputId}-preview`
            }
            className={cn(
              "w-full rounded-xl border bg-surface-2 px-4 py-2.5 text-white outline-none transition",
              "placeholder:text-ink-dim",
              // Reserve right padding for the preview pill so the typed
              // value never sits underneath it.
              "pr-44",
              hasError
                ? "border-coral focus:border-coral focus:ring-2 focus:ring-coral/25"
                : "border-white/10 focus:border-mint focus:ring-2 focus:ring-mint/25",
              className,
            )}
            {...rest}
          />
          <span
            id={`${inputId}-preview`}
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2",
              "rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
              hasDiscount
                ? "bg-coral/15 text-coral border border-coral/30"
                : "bg-mint/15 text-mint border border-mint/30",
            )}
          >
            {previewText}
          </span>
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-coral">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-help`} className="mt-1 text-xs text-ink-dim">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
PriceInput.displayName = "PriceInput";
