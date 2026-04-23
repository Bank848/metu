import { forwardRef, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Phase 10 / Step 2 — textarea primitive.
 *
 * Matches TextInput's pattern: mint focus ring, coral error state, label
 * above, helper/error below. `resize-none` by default because every
 * authoring textarea in the codebase uses fixed rows — callers who want
 * resizable can override via className.
 */
export interface TextareaInputProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const TextareaInput = forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  ({ label, helperText, error, className, id, rows = 3, ...rest }, ref) => {
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
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={hasError || undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-help`
                : undefined
          }
          className={cn(
            "w-full rounded-xl border bg-surface-2 px-4 py-2.5 text-white outline-none transition resize-none",
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
TextareaInput.displayName = "TextareaInput";
