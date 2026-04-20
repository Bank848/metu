"use client";
import { useEffect } from "react";

// Pure-CSS confetti burst — no external dep required for the demo.
export function Confetti() {
  useEffect(() => {
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
      clearTimeout(t);
      container.remove();
      style.remove();
    };
  }, []);
  return null;
}
