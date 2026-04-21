"use client";
import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { WriteReviewDialog } from "@/components/WriteReviewDialog";
import { cn } from "@/lib/utils";

/**
 * Tiny pill button that lets the buyer review a product they bought.
 * Lives inside the order receipt's line items.
 *
 * When the user already reviewed the product (`alreadyReviewed`), the button
 * collapses to a green tick + "Reviewed" disabled state — keeps the receipt
 * clean and prevents duplicate reviews.
 */
export function ReviewItemButton({
  productId,
  alreadyReviewed,
}: {
  productId: number;
  alreadyReviewed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (alreadyReviewed || done) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          "bg-green-500/15 text-green-400 border border-green-500/30",
        )}
      >
        <Check className="h-3 w-3" />
        Reviewed
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition",
          "bg-metu-yellow/15 text-metu-yellow border border-metu-yellow/35",
          "hover:bg-metu-yellow/25 hover:border-metu-yellow/60",
        )}
      >
        <Pencil className="h-3 w-3" />
        Write a review
      </button>
      {open && (
        <WriteReviewDialog
          productId={productId}
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setDone(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
