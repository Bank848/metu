"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible text block. Shows the first `previewChars` characters + a
 * "Show more" toggle when the full string is longer. For short strings
 * the toggle is hidden entirely so layouts stay tight.
 */
export function ExpandableText({
  text,
  previewChars = 140,
  className,
}: {
  text: string;
  previewChars?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const needsToggle = text.length > previewChars;
  const visible = open || !needsToggle ? text : text.slice(0, previewChars).trimEnd() + "…";

  return (
    <div className={cn("text-ink-secondary leading-relaxed", className)}>
      <p className="whitespace-pre-line">{visible}</p>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-metu-yellow hover:underline"
        >
          {open ? "Show less" : "Show more"}
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}
