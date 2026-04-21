"use client";
import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn, isDataUrl } from "@/lib/utils";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const main = images[active];

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-[4/3] rounded-2xl glass-morphism overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/20">
          <Package className="h-16 w-16" strokeWidth={1.5} />
        </div>
        {main && (
          <Image
            key={main}
            src={main}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover animate-fade-in-up"
            unoptimized={isDataUrl(main)}
            priority
          />
        )}
        {/* gold accent bar */}
        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent" />
      </div>

      {/* Thumb strip */}
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((img, i) => (
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
              <Image src={img} alt="" fill sizes="(max-width: 768px) 25vw, 12vw" className="object-cover" unoptimized={isDataUrl(img)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
