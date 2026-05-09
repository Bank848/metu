"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Buyer's escape hatch when the recipient's inbox didn't catch the
// claim email — copy the private link to the clipboard so the buyer
// can forward it via Line / Messenger / etc.
export function CopyGiftLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handle() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / non-secure contexts: select-and-prompt fallback.
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-2 rounded-full bg-metu-yellow text-space-950 px-4 py-2 text-xs font-bold hover:bg-metu-yellow/90 transition disabled:opacity-50"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy gift link"}
    </button>
  );
}
