"use client";
import { useEffect } from "react";
import { play } from "@/lib/sound";

// Pure-CSS confetti burst — no external dep required for the demo.
// Pairs with the new `purchase` audio cue (lib/sound.ts) so the
// celebratory triad-arpeggio + sparkle topper lands the moment the
// confetti starts falling. The cue is muted by the existing
// `metu-sound-muted` localStorage flag if the user has muted sounds.
export function Confetti() {
  useEffect(() => {
    // Tell every cart-badge subscriber to refetch — the order is paid,
    // so the active cart was cleared server-side via clearCartAfterPayment
    // / finalizeOrder, but useCartCount otherwise has to wait up to 60s
    // for its polling backstop to notice.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cart:update"));
    }
    // Defer audio one tick so a parent that unmounts on the same render
    // frame (e.g. router replace mid-effect) skips the cue entirely.
    let cancelled = false;
    const audioTimer = window.setTimeout(() => {
      if (!cancelled) play("purchase");
    }, 0);
    const colors = ["#FBBF24", "#F59E0B", "#1F2937", "#FEF3C7"];
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
    for (let i = 0; i < 120; i++) {
      const piece = document.createElement("div");
      const size = 6 + Math.random() * 8;
      piece.style.cssText = `
        position:absolute;
        top:${-20}px;
        left:${Math.random() * 100}%;
        width:${size}px;
        height:${size * 0.4}px;
        background:${colors[i % colors.length]};
        border-radius:2px;
        transform:rotate(${Math.random() * 360}deg);
        animation:metu-fall ${3 + Math.random() * 3}s ${Math.random() * 1.5}s linear forwards;
      `;
      container.appendChild(piece);
    }
    const style = document.createElement("style");
    style.textContent = `@keyframes metu-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`;
    document.head.appendChild(style);
    document.body.appendChild(container);
    const t = setTimeout(() => {
      container.remove();
      style.remove();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(audioTimer);
      clearTimeout(t);
      container.remove();
      style.remove();
    };
  }, []);
  return null;
}
