"use client";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, toggleMute, play } from "@/lib/sound";

/**
 * Speaker icon in the TopNav. Clicking flips `metu-sound-muted` in
 * localStorage and plays a tiny click so the user hears it came back on.
 */
export function SoundToggle() {
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
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-metu-yellow hover:bg-white/5 transition"
      suppressHydrationWarning
    >
      <Icon className="h-5 w-5" aria-hidden={!ready} />
    </button>
  );
}
