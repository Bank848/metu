"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

/**
 * Three-dots row-actions dropdown for admin tables.
 * Tone palette: default/primary = gold, destructive = coral (recoverable),
 * safe = mint. When `confirm` is set, picking the action opens an in-page
 * <ConfirmDialog> instead of native `window.confirm()`.
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
  // Flip the popover upwards when the trigger is near the viewport bottom.
  const [openUp, setOpenUp] = useState(false);
  // Stashed action whose `confirm` modal is awaiting user response.
  const [pendingAction, setPendingAction] = useState<ActionRowItem | null>(null);

  // Comfortable upper bound on menu height (5-6 items). We don't measure
  // the rendered menu to avoid a double-render flicker.
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
            // Right-anchored so the menu doesn't push off table-row edges.
            "absolute right-0 w-48 rounded-xl border border-line bg-space-900 shadow-floating py-1 z-50",
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
