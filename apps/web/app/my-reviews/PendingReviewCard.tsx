"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Package, Pencil, Check } from "lucide-react";
import { WriteReviewDialog } from "@/components/WriteReviewDialog";
import { cn } from "@/lib/utils";

export function PendingReviewCard({
  productId,
  name,
  image,
  storeName,
  storeId,
}: {
  productId: number;
  name: string;
  image: string | null;
  storeName: string;
  storeId: number;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <>
      <div
        className={cn(
          "rounded-2xl glass-morphism p-4 flex items-center gap-3 transition",
          done && "opacity-60",
        )}
      >
        <Link
          href={`/product/${productId}`}
          className="relative h-16 w-16 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8 hover:border-metu-yellow/40 transition flex items-center justify-center"
        >
          <Package className="h-5 w-5 text-metu-yellow/30 absolute" />
          {image && (
            <Image src={image} alt="" fill sizes="64px" className="object-cover relative" unoptimized />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-dim mb-0.5">
            <Link href={`/store/${storeId}`} className="hover:text-metu-yellow">
              {storeName}
            </Link>
          </div>
          <Link
            href={`/product/${productId}`}
            className="text-sm font-semibold text-white hover:text-metu-yellow line-clamp-1"
          >
            {name}
          </Link>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 px-3 py-1 text-[11px] font-semibold shrink-0">
            <Check className="h-3 w-3" />
            Done
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-metu-yellow/15 text-metu-yellow border border-metu-yellow/35 hover:bg-metu-yellow/25 hover:border-metu-yellow/60 px-3 py-1 text-[11px] font-semibold shrink-0 transition"
          >
            <Pencil className="h-3 w-3" />
            Review
          </button>
        )}
      </div>
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
