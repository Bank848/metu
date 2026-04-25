"use client";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

/**
 * Phase 11 / F13 — clickable seller attribution under a product card.
 *
 * The audit flagged that "Nok Press" / "Kloy Studio" labels under each
 * product card looked clickable (icon + label) but were rendered as
 * plain `<span>` text. This pill is a real `<Link href="/store/[id]">`
 * so a buyer can jump to the seller without first opening the product.
 *
 * The card it lives in is itself a `<Link>` (see `ProductCard.tsx`).
 * Browsers handle nested anchors but they're invalid HTML and can
 * confuse screen readers. We sidestep the issue by stopping the click
 * before it bubbles into the parent card-link, so the inner navigation
 * wins. The same `e.stopPropagation()` trick is used by `FavoriteButton`
 * and `CompareToggle` — see `FavoriteButton.tsx:31-36`.
 *
 * The visible text + icon stay identical to the previous span so the
 * card layout doesn't shift. Only the cursor + hover colour changes
 * to communicate the new affordance.
 */
export function StoreNameLink({
  storeId,
  storeName,
}: {
  storeId: number;
  storeName: string;
}) {
  return (
    <Link
      href={`/store/${storeId}`}
      onClick={(e) => {
        // Don't let the click bubble into the parent <ProductCard> link
        // — the user's intent is "go to the store", not "open the
        // product". `relative z-10` keeps this stacked above the card's
        // pointer hit-area.
        e.stopPropagation();
      }}
      className="relative z-10 inline-flex items-center gap-1 text-xs font-medium text-ink-dim hover:text-metu-yellow transition-colors"
      title={`Visit ${storeName}`}
    >
      <BadgeCheck className="h-3 w-3 text-metu-yellow/80" />
      {storeName}
    </Link>
  );
}
