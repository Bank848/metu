"use client";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

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
        e.stopPropagation();
      }}
      className="relative z-10 inline-flex items-center gap-1 text-xs font-medium text-ink-dim hover:text-metu-yellow transition-colors"
      title={`Visit ${storeName}`}
    >
      {storeName}
    </Link>
  );
}
