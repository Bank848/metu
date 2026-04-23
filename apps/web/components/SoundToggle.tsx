"use client";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, toggleMute, play, primeAudio } from "@/lib/sound";
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
 *
 * Bug fix: the SSR default used to be `muted=true`. The real lib
 * default (lib/sound.ts:isMuted) is unmuted, so the icon and the
 * actual behaviour disagreed for the first paint — users saw the
 * VolumeX (muted) icon and clicked it expecting to UN-mute, which
 * actually MUTED them. We now mirror the lib default. The
 * `suppressHydrationWarning` covers the edge case where the user
 * has a stored preference that differs.
 *
 * Also: pre-warms the AudioContext on the first user gesture so
 * async play() calls (after a fetch resolves — cart add, review
 * post) actually produce sound. Without the prime, Chrome's autoplay
 * policy silently dropped them because the context was created
 * mid-async, outside any active gesture window.
 */
export function SoundToggle({
  className,
  inCluster = false,
}: {
  className?: string;
  inCluster?: boolean;
}) {
  const [muted, setMuted] = useState<boolean>(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMuted(isMuted());
    setReady(true);

    // Prime the AudioContext on the first pointerdown / keydown so
    // async play() calls aren't blocked by Chrome's autoplay policy.
    const onFirstGesture = () => {
      primeAudio();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMuted(Boolean(detail));
    };
    window.addEventListener("metu-mute-change", handler);
    return () => {
      window.removeEventListener("metu-mute-change", handler);
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
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
