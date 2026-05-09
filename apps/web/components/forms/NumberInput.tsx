import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  helperText?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  rightSlot?: ReactNode;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, helperText, error, className, id, min, max, step, rightSlot, ...rest }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const hasError = Boolean(error);

    return (
      <div className="block">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-white mb-1.5">
            {label}
          </label>
        )}

        <div className={cn(
          "flex items-stretch rounded-xl border bg-surface-2 transition overflow-hidden",
          "focus-within:ring-2",
          hasError
            ? "border-coral focus-within:border-coral focus-within:ring-coral/25"
            : "border-white/10 focus-within:border-metu-yellow focus-within:ring-mint/25",
        )}>
          <input
            ref={ref}
            id={inputId}
            type="number"
            min={min}
            max={max}
            step={step}
            aria-invalid={hasError || undefined}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined
            }
            className={cn(
              "flex-1 min-w-0 bg-transparent px-4 py-2.5 text-white outline-none",
              "placeholder:text-ink-dim",
              className,
            )}
            {...rest}
          />

          {rightSlot && (
            <div className="flex items-stretch border-l border-white/10">
              {rightSlot}
            </div>
          )}
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-coral">{error}</p>
        ) : helperText ? (
          <p id={`${inputId}-help`} className="mt-1 text-xs text-ink-dim">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";