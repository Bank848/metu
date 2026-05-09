import { forwardRef, type InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Number input primitive — same chrome as TextInput, locked to
 * type="number" with explicit min/max/step. Keeps the native spinners
 * since the seller flow is desktop-first.
 */
export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  helperText?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, helperText, error, className, id, min, max, step, ...rest }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const hasError = Boolean(error);
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
        <input
          ref={ref}
          id={inputId}
          type="number"
          min={min}
          max={max}
          step={step}
          aria-invalid={hasError || undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-help`
                : undefined
          }
          className={cn(
            "w-full rounded-xl border bg-surface-2 px-4 py-2.5 text-white outline-none transition",
            "placeholder:text-ink-dim",
            hasError
              ? "border-coral focus:border-coral focus:ring-2 focus:ring-coral/25"
              : "border-white/10 focus:border-mint focus:ring-2 focus:ring-mint/25",
            className,
          )}
          {...rest}
        />
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
NumberInput.displayName = "NumberInput";
