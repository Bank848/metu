import { forwardRef, type SelectHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

/**
 * Phase 10 / Step 2 — select primitive.
 *
 * Same focus-ring + error styling as the other input primitives so a
 * row of mixed inputs aligns visually. Options come in via a flat array
 * rather than `<option>` children — keeps callers from fighting React
 * key warnings and makes the API one-line per option.
 *
 * We ship a default `text-white` colour on the select but rely on the
 * native menu for the dropdown itself (reskinning a real `<select>`'s
 * popup requires a full custom listbox; out of scope for primitives).
 */
export interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  /** Optional placeholder rendered as the first, disabled <option>. */
  placeholder?: string;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  (
    { label, helperText, error, className, id, options, placeholder, value, ...rest },
    ref,
  ) => {
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
        <select
          ref={ref}
          id={inputId}
          value={value}
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
            hasError
              ? "border-coral focus:border-coral focus:ring-2 focus:ring-coral/25"
              : "border-white/10 focus:border-mint focus:ring-2 focus:ring-mint/25",
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
SelectInput.displayName = "SelectInput";
