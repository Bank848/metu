"use client";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

/**
 * Clickable seller attribution under a product card. Renders as a real
 * <Link> so buyers can jump straight to the store. `stopPropagation`
 * keeps the click from bubbling into the parent ProductCard link
 * (nested <a> would be invalid HTML).
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
        // Stop the click bubbling into the parent ProductCard link.
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
