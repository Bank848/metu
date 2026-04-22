"use client";
import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native Web Share where available (mobile + Chrome/Edge desktop), falls
 * back to clipboard copy with a "Copied!" affordance for browsers that
 * don't support `navigator.share`.
 */
export function ShareButton({
  title,
  text,
  size = "sm",
  className,
}: {
  title: string;
  text?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const dims = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconDims = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  async function share(e: React.MouseEvent) {
    // Prevent the click from bubbling up if we're nested in a <Link>.
    e.preventDefault();
    e.stopPropagation();
    const url = typeof window !== "undefined" ? window.location.href : "";
    const payload: ShareData = { title, text: text ?? title, url };
    try {
      if (navigator.share && navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return;
      }
    } catch {
      // User cancelled, or share failed — fall through to clipboard.
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* swallow */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share"
      title={copied ? "Copied!" : "Share"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border bg-surface-1/70 border-white/15 text-white/80 hover:text-metu-yellow hover:border-metu-yellow/50 backdrop-blur transition",
        dims,
        copied && "border-green-400/60 text-green-400",
        className,
      )}
    >
      {copied ? <Check className={iconDims} /> : <Share2 className={iconDims} />}
    </button>
  );
}
