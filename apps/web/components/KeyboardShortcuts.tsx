"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";

/**
 * Global keyboard shortcuts. Mounted once in the root layout.
 *
 *   /        Focus the search pill in TopNav
 *   g h      Go home
 *   g b      Go to /browse
 *   g c      Go to /cart
 *   g f      Go to /favorites
 *   g o      Go to /orders
 *   g p      Go to /profile
 *   ?        Open / close the cheatsheet
 *
 * Two-key sequences (g + …) use a 1.2 s window — feels like Gmail / GitHub.
 * We never fire when the user is typing in an input/textarea so search
 * boxes still work normally.
 */
const SEQUENCE_TIMEOUT_MS = 1200;

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: "/", label: "Focus the search bar" },
  { keys: "g h", label: "Home" },
  { keys: "g b", label: "Browse" },
  { keys: "g c", label: "Cart" },
  { keys: "g f", label: "Favorites" },
  { keys: "g o", label: "Orders" },
  { keys: "g p", label: "Profile" },
  { keys: "?", label: "Show this cheatsheet" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingG = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Trap focus inside the cheatsheet while it's open so Tab cycles
  // through Close + the back-link without escaping into the page.
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    function clearG() {
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
      }
    }

    function go(href: string) {
      router.push(href);
    }

    function onKeyDown(e: KeyboardEvent) {
      // Always allow ESC to close the cheatsheet.
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Two-key g-sequences.
      if (pendingG.current !== null) {
        clearG();
        switch (e.key.toLowerCase()) {
          case "h": e.preventDefault(); go("/"); return;
          case "b": e.preventDefault(); go("/browse"); return;
          case "c": e.preventDefault(); go("/cart"); return;
          case "f": e.preventDefault(); go("/favorites"); return;
          case "o": e.preventDefault(); go("/orders"); return;
          case "p": e.preventDefault(); go("/profile"); return;
          default: return; // unknown — abort sequence silently
        }
      }

      switch (e.key) {
        case "/": {
          // Focus the search input that lives inside SearchPill.
          const input = document.querySelector<HTMLInputElement>(
            "header input[type='search'], header input[name='q']",
          );
          if (input) {
            e.preventDefault();
            input.focus();
            input.select();
          }
          return;
        }
        case "?": {
          e.preventDefault();
          setOpen((v) => !v);
          return;
        }
        case "g":
        case "G": {
          // Begin a sequence.
          pendingG.current = window.setTimeout(clearG, SEQUENCE_TIMEOUT_MS);
          return;
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearG();
    };
  }, [router, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-surface-1/85" onClick={() => setOpen(false)} />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl glass-morphism-strong p-6 shadow-pop"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 font-display font-extrabold text-lg text-white">
            <Keyboard className="h-4 w-4 text-metu-yellow" />
            Keyboard shortcuts
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-ink-dim hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between">
              <span className="text-ink-secondary">{s.label}</span>
              <KeyChips keys={s.keys} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-ink-dim">
          Sequences time out after {Math.round(SEQUENCE_TIMEOUT_MS / 100) / 10}s. Press{" "}
          <KeyChips keys="?" /> any time to reopen this.
        </p>
      </div>
    </div>
  );
}

function KeyChips({ keys }: { keys: string }) {
  const parts = keys.split(" ");
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((k, i) => (
        <kbd
          key={i}
          className={cn(
            "rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5",
            "font-mono text-[11px] text-white",
          )}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
