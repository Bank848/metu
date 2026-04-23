"use client";
import { useEffect } from "react";

/**
 * Confine keyboard focus inside `containerRef` while `active` is true.
 *
 * Behaviour:
 *   - On open: moves focus to the first focusable element inside the
 *     container (or the container itself if it has tabindex=-1).
 *   - Tab on the last focusable wraps to the first; Shift+Tab on the
 *     first wraps to the last.
 *   - On close (or unmount): restores focus to whatever element was
 *     focused before the trap opened.
 *
 * This is the WCAG 2.1.2 / 2.4.3 compliance trick — without it, a
 * keyboard user can `Tab` straight out of an open dialog into the
 * hidden page underneath, which is disorienting and unsafe.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, isOpen);
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: React.RefObject<T>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Snapshot the previously-focused element so we can restore it on
    // close. document.activeElement is the most reliable source — it
    // reflects whatever the browser was focused on when the dialog opened.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const FOCUSABLE_SELECTOR = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled]):not([type='hidden'])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
      "[contenteditable='true']",
    ].join(",");

    function getFocusable(): HTMLElement[] {
      if (!container) return [];
      // Filter out hidden elements — getClientRects() is the cheapest way
      // to detect display:none / visibility:hidden ancestors.
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    }

    // Move focus inside on open. We defer to the next tick so any
    // mount-time autofocus from React lands first and we don't fight it.
    const focusInside = () => {
      const focusable = getFocusable();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        // No focusable child — make the container itself focusable so
        // screen readers still announce it as the active region.
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    };
    const tickHandle = window.setTimeout(focusInside, 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (activeEl === first || !container!.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(tickHandle);
      document.removeEventListener("keydown", onKeyDown);
      // Restore the trigger's focus so the user lands back where they
      // were before opening the dialog.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
