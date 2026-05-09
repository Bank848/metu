"use client";
import { useState } from "react";
import Image from "next/image";
import { Package, ZoomIn, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn, isDataUrl } from "@/lib/utils";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);

  const markBroken = (i: number) =>
    setBroken((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });

  const main = images[active];
  const mainBroken = broken.has(active);

  const openLightbox = (i: number) => setLightbox(i);
  const closeLightbox = () => setLightbox(null);
  const prev = () => setLightbox((i) => ((i ?? 0) - 1 + images.length) % images.length);
  const next = () => setLightbox((i) => ((i ?? 0) + 1) % images.length);

  return (
    <>
      <div>
        {/* Main image */}
        <div
          className="group relative aspect-[4/3] rounded-2xl glass-morphism overflow-hidden cursor-zoom-in"
          onClick={() => openLightbox(active)}
        >
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
              className="object-cover animate-fade-in-up transition-transform duration-500 group-hover:scale-[1.02]"
              unoptimized={isDataUrl(main)}
              priority
              onError={() => markBroken(active)}
            />
          )}

          {/* Hover zoom hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 backdrop-blur-sm rounded-full p-2.5">
              <ZoomIn className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Nav arrows on main image */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((a) => (a - 1 + images.length) % images.length); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((a) => (a + 1) % images.length); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all z-10"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-bold text-white/80">
              {active + 1} / {images.length}
            </div>
          )}

          {/* Gold accent bar */}
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent" />
        </div>

        {/* Thumb strip */}
        {images.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {images.slice(0, 5).map((img, i) => {
              const isBroken = broken.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "group/thumb relative aspect-square rounded-xl overflow-hidden border transition",
                    active === i
                      ? "border-metu-yellow ring-2 ring-metu-yellow/30"
                      : "border-white/8 hover:border-metu-yellow/40",
                  )}
                  aria-label={`View image ${i + 1}`}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/25">
                    <Package className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  {!isBroken && (
                    <Image
                      src={img}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 20vw, 10vw"
                      className="object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                      unoptimized={isDataUrl(img)}
                      onError={() => markBroken(i)}
                    />
                  )}
                  {/* Active overlay */}
                  {active === i && (
                    <div className="absolute inset-0 bg-metu-yellow/10" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowRight") next();
            if (e.key === "ArrowLeft") prev();
          }}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
          role="dialog"
          aria-modal
          tabIndex={-1}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
            onClick={closeLightbox}
            aria-label="Close lightbox"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Full image */}
          <div
            className="relative max-h-[88vh] max-w-[88vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightbox]}
              alt={`${alt} — image ${lightbox + 1}`}
              className="max-h-[88vh] max-w-[88vw] object-contain rounded-xl shadow-2xl"
            />
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Dot indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 items-center">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === lightbox
                      ? "w-5 h-1.5 bg-metu-yellow"
                      : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60",
                  )}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold text-white/70">
            {lightbox + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}