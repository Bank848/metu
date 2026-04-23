"use client";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, toggleMute, play } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Speaker icon, designed to live inside the TopNav "control cluster"
 * (Sound · Theme · Locale). When `inCluster` is true (the default in
 * TopNav) we render a square, borderless icon button that nests inside
 * the cluster's shared rounded shell. When false (legacy callers, or
 * standalone usage) we keep the original pill silhouette.
 *
 * Clicking flips `metu-sound-muted` in localStorage and plays a tiny
 * click so the user hears it came back on.
 */
export function SoundToggle({
  className,
  inCluster = false,
}: {
  className?: string;
  inCluster?: boolean;
}) {
  // Initialise as true during SSR so the silence-by-default renders; we
  // swap to the real state in an effect to avoid hydration mismatch.
  const [muted, setMuted] = useState<boolean>(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMuted(isMuted());
    setReady(true);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMuted(Boolean(detail));
    };
    window.addEventListener("metu-mute-change", handler);
    return () => window.removeEventListener("metu-mute-change", handler);
  }, []);

  const Icon = muted ? VolumeX : Volume2;

  return (
    <button
      type="button"
      onClick={() => {
        const now = toggleMute();
        if (!now) play("click"); // audible confirmation on un-mute
      }}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Unmute sounds" : "Mute sounds"}
      className={cn(
        inCluster
          ? // Inside the cluster: 32x32 square-ish, rounded-md, no
            // border (the cluster shell owns the outline). Hover tint
            // is white-fade so the cluster reads as one chip.
            "flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:text-white hover:bg-white/10 transition"
          : // Standalone fallback for legacy callers.
            "flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-metu-yellow hover:bg-white/5 transition",
        className,
      )}
      suppressHydrationWarning
    >
      <Icon className={inCluster ? "h-4 w-4" : "h-5 w-5"} aria-hidden={!ready} />
    </button>
  );
}
