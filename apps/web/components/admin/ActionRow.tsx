"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * The `confirm` prop wraps the click in `window.confirm()`. We use the
 * native dialog because admin actions are infrequent and the existing
 * codebase (StoreActions.tsx, etc.) uses the same pattern — wiring up a
 * full confirm-modal primitive can land in a later step.
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

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function handlePick(action: ActionRowItem) {
    if (action.disabled) return;
    if (action.confirm && typeof window !== "undefined" && !window.confirm(action.confirm)) {
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
            "absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-line bg-space-900 shadow-floating py-1 z-50",
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
    </div>
  );
}
