"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import type { KioskData } from "@/lib/server/kiosk";
import { HeroSlide } from "./slides/HeroSlide";
import { ErSlide } from "./slides/ErSlide";
import { LiveMetricsSlide } from "./slides/LiveMetricsSlide";
import { TechStackSlide } from "./slides/TechStackSlide";
import { ClosingSlide } from "./slides/ClosingSlide";

// 5 slides × ~10s/each = ~50s loop. We refresh the underlying data
// (server-side fetch) every full loop so the live metrics breathe
// without the kiosk operator having to touch anything.
const SLIDE_DURATION_MS = 10_000;

interface SlideDef {
  id: string;
  label: string;
  durationMs?: number;
  render: (ctx: { data: KioskData; active: boolean }) => React.ReactNode;
}

const SLIDES: SlideDef[] = [
  { id: "hero",    label: "Welcome",       render: ({ data, active }) => <HeroSlide data={data} active={active} /> },
  { id: "er",      label: "Database map",  durationMs: 14_000, render: () => <ErSlide /> },
  { id: "live",    label: "Live metrics",  render: ({ data }) => <LiveMetricsSlide data={data} /> },
  { id: "stack",   label: "Tech stack",    render: () => <TechStackSlide /> },
  { id: "closing", label: "Try it",        render: () => <ClosingSlide /> },
];

export function Kiosk({ data }: { data: KioskData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Operator can pin a single slide for Q&A by adding ?paused=1 — the
  // loop pauses but the indicator + arrow keys still work for manual
  // navigation.
  const initialPaused = searchParams.get("paused") === "1";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(initialPaused);
  const [tick, setTick] = useState(0); // forces progress bar reset
  const loopCountRef = useRef(0);

  const currentSlide = SLIDES[index]!;
  const slideDuration = currentSlide.durationMs ?? SLIDE_DURATION_MS;

  // Auto-advance loop. Refreshing the page every full loop pulls fresh
  // server-side data (counts/top stores/etc) without a separate API call.
  useEffect(() => {
    if (paused) return;
    const handle = window.setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      if (next === 0) {
        loopCountRef.current += 1;
        // Refresh after every loop so live metrics stay current. The
        // server component re-fetches from Postgres on each render so
        // this is the cheapest way to keep the kiosk synced.
        router.refresh();
      }
      setIndex(next);
      setTick((t) => t + 1);
    }, slideDuration);
    return () => window.clearTimeout(handle);
  }, [index, paused, slideDuration, router]);

  // Keyboard shortcuts: Space pauses, arrows step manually, R reloads.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => (i + 1) % SLIDES.length);
        setTick((t) => t + 1);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
        setTick((t) => t + 1);
      } else if (e.code === "KeyR") {
        e.preventDefault();
        router.refresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <main className="fixed inset-0 bg-space-black text-white overflow-hidden">
      {/* Ambient gradient blobs — same vibe as the original feature tour
          but now they sit behind every slide instead of just the hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-mint/10 blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-3xl animate-blob-slow [animation-delay:-7s]" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-3xl animate-blob-slow [animation-delay:-14s]" />
      </div>

      {/* Slide stack — only the current slide is visible; cross-fade
          between them so transitions read smoothly from across a room. */}
      <div className="absolute inset-0">
        {SLIDES.map((slide, i) => {
          const visible = i === index;
          return (
            <div
              key={slide.id}
              aria-hidden={!visible}
              className="absolute inset-0 transition-opacity duration-700 ease-out"
              style={{
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              {visible && slide.render({ data, active: visible })}
            </div>
          );
        })}
      </div>

      {/* Progress bar — keyed off `tick` so its CSS animation restarts
          on every slide change without us managing time manually. */}
      {!paused && (
        <div
          key={`progress-${tick}`}
          className="absolute top-0 left-0 h-1 bg-metu-yellow"
          style={{
            animation: `kiosk-progress ${slideDuration}ms linear forwards`,
          }}
        />
      )}

      {/* Slide dots + pause hint (bottom). pointer-events-none on the
          row so a stray cursor can't intercept the slide content; only
          the controls themselves take clicks. */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-none">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-space-950/70 backdrop-blur px-4 py-2 pointer-events-auto">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.label}
              onClick={() => {
                setIndex(i);
                setTick((t) => t + 1);
              }}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-8 bg-metu-yellow" : "w-2 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="ml-2 inline-flex items-center justify-center h-7 w-7 rounded-full text-ink-secondary hover:text-white hover:bg-white/10"
            title={paused ? "Resume (Space)" : "Pause (Space)"}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Tiny corner badge for the operator. Hidden in fullscreen mode
          but still discoverable when you mouse near it. */}
      <div className="absolute top-3 right-3 text-[10px] font-mono text-ink-dim pointer-events-none select-none">
        space pause · ← → step · r refresh
      </div>

      <style jsx global>{`
        @keyframes kiosk-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </main>
  );
}
