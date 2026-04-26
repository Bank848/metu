"use client";
import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn, isDataUrl } from "@/lib/utils";

/**
 * Phase 11 run #2 / F5 — when an image URL 404s (or returns a non-image
 * payload), Next.js silently leaves the slot blank, which produced the
 * "empty rounded rectangle" QA flagged on /product/100's second
 * thumbnail. We track which indexes failed in state and substitute the
 * lucide Package fallback that the main hero already uses, so the slot
 * never reads as "broken UI".
 */
export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const markBroken = (i: number) =>
    setBroken((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });

  const main = images[active];
  const mainBroken = broken.has(active);

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-[4/3] rounded-2xl glass-morphism overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/20">
          <Package className="h-16 w-16" strokeWidth={1.5} />
        </div>
        {main && !mainBroken && (
          <Image
            key={main}
            src={main}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover animate-fade-in-up"
            unoptimized={isDataUrl(main)}
            priority
            onError={() => markBroken(active)}
          />
        )}
        {/* gold accent bar */}
        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent" />
      </div>

      {/* Thumb strip */}
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((img, i) => {
            const isBroken = broken.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border transition",
                  active === i
                    ? "border-metu-yellow ring-2 ring-metu-yellow/30"
                    : "border-white/8 hover:border-metu-yellow/40",
                )}
                aria-label={`View image ${i + 1}`}
              >
                {/* Always paint the placeholder underneath so a broken
                    URL leaves a recognisable cube icon instead of an
                    empty rectangle. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/25"
                >
                  <Package className="h-6 w-6" strokeWidth={1.5} />
                </span>
                {!isBroken && (
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 25vw, 12vw"
                    className="object-cover"
                    unoptimized={isDataUrl(img)}
                    onError={() => markBroken(i)}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
