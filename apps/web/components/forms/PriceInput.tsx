import { forwardRef, type InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";

/**
 * Phase 10 / Step 2 — currency-aware variant of NumberInput.
 *
 * Renders the standard input chrome plus a "Buyer sees: ฿XXX" preview
 * pill that floats inside the right edge of the field. The pill updates
 * live as the seller types so they don't have to do mental arithmetic
 * when entering a discount.
 *
 * The currency prop exists for forward-compat — every product on the
 * marketplace today is THB but the API model carries currency, so the
 * primitive should accept it. Today only "THB" is wired to a symbol;
 * other codes fall through to the code itself in the preview.
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
          ? `Buyer sees: ${money(finalPrice)} after ${discountPercent}% off`
          : `Buyer sees: ${money(finalPrice)}`
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
