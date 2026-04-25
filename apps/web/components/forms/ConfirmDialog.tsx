"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { GlassButton } from "@/components/visual/GlassButton";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";

/**
 * Phase 11 / F19 — reusable in-page confirm modal.
 *
 * Replaces the native `window.confirm()` calls scattered across
 * destructive UI surfaces (review delete, Q&A delete, ActionRow row
 * actions, seller order status flips, product delete, bulk price
 * adjust). The native dialog clashes with the rest of the polished
 * chrome, can't be styled, and the QA report (`reports/qa-2026-04-25.md`
 * §F19) flagged that it locks Chrome MCP in admin moderation flows.
 *
 * Pattern (per `reports/decisions/RESOLVED-2026-04-25.md` Decision 4):
 *   - Sits next to the other Step-2 form primitives (`FormSection`,
 *     `TextInput`, etc.) so dialogs and inputs live in one place.
 *   - Mirrors the `<WriteReviewDialog>` modal shape — fixed-position
 *     overlay, glass-morphism panel, X close button, ESC + click-outside
 *     dismiss.
 *   - Uses `useFocusTrap` from `lib/useFocusTrap.ts` so keyboard users
 *     can't `Tab` out of the open dialog (WCAG 2.1.2 / 2.4.3).
 *   - Primary "confirm" button is auto-focused on open so a single
 *     Enter keypress completes the action.
 *   - `tone="destructive"` paints the confirm button coral — matches
 *     the destructive-row colour used in `ActionRow.tsx` and the
 *     design-system §9 don'ts (red stays reserved for hard / final
 *     destructive moments; coral is the recoverable register).
 *
 * The component is render-controlled — callers own the `open` state
 * and pass `onConfirm` / `onCancel` callbacks. `onConfirm` may return
 * a Promise so async delete handlers can await the network response
 * before the dialog closes (callers typically close it themselves
 * inside the success branch).
 */

export type ConfirmTone = "default" | "destructive";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap is the WCAG compliance trick — without it, a keyboard
  // user can Tab straight out of the open dialog into the page beneath.
  // useFocusTrap also restores focus to the trigger element on close.
  useFocusTrap(dialogRef, open);

  // ESC dismiss + body scroll lock — matches WriteReviewDialog.tsx:47-55.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  // Auto-focus the primary "confirm" button on open so Enter completes
  // the action immediately. We defer one tick so the focus-trap's own
  // initial-focus call (which lands on the first focusable element —
  // the close X) doesn't fight us.
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  if (!open) return null;

  const isDestructive = tone === "destructive";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={body ? "confirm-dialog-body" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-surface-1/85 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl glass-morphism-strong p-6 animate-fade-in-up"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-full text-ink-dim hover:text-white hover:bg-white/10"
          aria-label={cancelLabel}
        >
          <X className="h-4 w-4" />
        </button>

        <h3
          id="confirm-dialog-title"
          className={cn(
            "font-display text-xl font-bold pr-8",
            isDestructive ? "text-coral" : "text-white",
          )}
        >
          {title}
        </h3>
        {body && (
          <div
            id="confirm-dialog-body"
            className="mt-2 text-sm text-ink-secondary leading-relaxed"
          >
            {body}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <GlassButton tone="glass" type="button" onClick={onCancel}>
            {cancelLabel}
          </GlassButton>
          <GlassButton
            ref={confirmBtnRef}
            tone={isDestructive ? "coral" : "gold"}
            type="button"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
