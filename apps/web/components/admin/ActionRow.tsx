"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

/**
 * Phase 10 / Step 2 — dropdown row-actions menu.
 *
 * Centralises the "three-dots → list of operations" pattern that admin
 * tables reach for (delete user, suspend store, refund txn, etc.). The
 * dismiss-on-click-outside behaviour is lifted from
 * `LocaleSwitcher.tsx:32-39` so all dropdowns in the app feel the same.
 *
 * Tone semantics map to the Wave-1 palette:
 *   - default     = metu-yellow (primary)
 *   - primary     = metu-yellow (alias for default — explicit when an
 *                   action is the "main" one in the list)
 *   - destructive = coral (soft alert) — note we do NOT use metu-red,
 *                   per docs/design-system.md §9 don'ts. Red stays
 *                   reserved for hard destructive actions like irrevers-
 *                   ible deletions. Coral is the "this is destructive
 *                   but recoverable" register that admin actions
 *                   typically inhabit.
 *   - safe        = mint (success / "live" / positive)
 *
 * Phase 11 / F19 — the `confirm` prop now opens an in-page
 * <ConfirmDialog> primitive instead of the native `window.confirm()`.
 * Public API is unchanged: callers pass `confirm: "Are you sure …?"`
 * and the row action dispatches only after the user clicks the modal's
 * primary button. The native dialog couldn't be styled, locked Chrome
 * MCP in admin moderation flows, and clashed with the rest of the
 * polished chrome (see `reports/qa-2026-04-25.md` §F19).
 */
export type ActionTone = "default" | "primary" | "destructive" | "safe";

export type ActionRowItem = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: ActionTone;
  confirm?: string;
  disabled?: boolean;
};

const toneClasses: Record<ActionTone, string> = {
  default:     "text-metu-yellow hover:bg-metu-yellow/10",
  primary:     "text-metu-yellow hover:bg-metu-yellow/10",
  destructive: "text-coral hover:bg-coral/10",
  safe:        "text-mint hover:bg-mint/10",
};

export interface ActionRowProps {
  actions: ActionRowItem[];
  /** Optional aria-label for the trigger. Defaults to "Row actions". */
  ariaLabel?: string;
  className?: string;
}

export function ActionRow({ actions, ariaLabel = "Row actions", className }: ActionRowProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Phase 45 follow-up — flip the popover above the trigger when the
  // trigger sits near the bottom of the viewport. Without this, a row
  // dropdown on the last user/store in the table dangled below the
  // page bottom and forced a scrollbar (see screenshot in chat). We
  // measure on each open + on resize so the direction stays correct
  // even when the user scrolls the page or rotates a device.
  const [openUp, setOpenUp] = useState(false);
  // Phase 11 / F19 — when a picked action carries a `confirm: string`
  // we stash the action here and open the in-page <ConfirmDialog>
  // primitive instead of calling `window.confirm()`. The dropdown
  // closes immediately on pick so the modal can take over the page.
  const [pendingAction, setPendingAction] = useState<ActionRowItem | null>(null);

  // Approximate menu height — tall enough to cover all admin menus
  // (5 items × 36px ≈ 180, plus padding). We don't measure the menu
  // itself because that would require a render pass; this estimate
  // is comfortably larger than every existing menu, so the flip is
  // accurate as long as menus stay under ~6 items.
  const ESTIMATED_MENU_HEIGHT = 220;

  function decideDirection() {
    const trigger = ref.current?.querySelector("button");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUp(spaceBelow < ESTIMATED_MENU_HEIGHT && rect.top > spaceBelow);
  }

  useEffect(() => {
    if (!open) return;
    decideDirection();
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      decideDirection();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  function handlePick(action: ActionRowItem) {
    if (action.disabled) return;
    if (action.confirm) {
      // Defer the actual onClick until the user confirms in the modal.
      setOpen(false);
      setPendingAction(action);
      return;
    }
    setOpen(false);
    action.onClick();
  }

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:text-white hover:bg-white/10 transition"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <ul
          role="menu"
          className={cn(
            // Anchor right so the menu doesn't push off the right edge of
            // a table row. shadow-floating matches the elevation scale
            // intended for popovers (see tailwind.config.ts §boxShadow).
            "absolute right-0 w-48 rounded-xl border border-line bg-space-900 shadow-floating py-1 z-50",
            // Phase 45 follow-up — flip up when there isn't enough room
            // below the trigger so the menu never dangles past the
            // viewport bottom (admin tables routinely had this on the
            // last row). `bottom-full` anchors the menu's bottom edge
            // to the trigger's top instead of dropping below.
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {actions.map((action, i) => {
            const Icon = action.icon;
            const tone = action.tone ?? "default";
            return (
              <li key={`${action.label}-${i}`} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handlePick(action)}
                  disabled={action.disabled}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition text-left",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    toneClasses[tone],
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={pendingAction !== null}
        title="Confirm action"
        body={pendingAction?.confirm}
        confirmLabel={pendingAction?.label ?? "Confirm"}
        // Map ActionRow's destructive tone to the dialog's destructive
        // tone so the primary button paints coral (matches the row
        // hover colour). All other tones use the default gold.
        tone={pendingAction?.tone === "destructive" ? "destructive" : "default"}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action) action.onClick();
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
