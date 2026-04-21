"use client";

/**
 * Tiny sound effect library built on the Web Audio API — no audio files
 * shipped, so total payload cost is ~0. Each cue is a short envelope of
 * one or more sine tones; feels nicer than stock WAVs and avoids shipping
 * binary assets in the bundle.
 *
 * Users can mute the whole thing via localStorage (`metu-sound-muted`).
 * The mute toggle lives in TopNav.
 */

type CueName = "cart" | "success" | "review" | "error" | "click";

const MUTE_KEY = "metu-sound-muted";

// Singleton AudioContext — browsers cap the number of live contexts per tab.
// Lazily created on first cue because Chrome blocks construction outside
// a user gesture in some contexts.
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Read the mute state from localStorage. Default: NOT muted. */
export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Toggle mute and return the new state. */
export function toggleMute(): boolean {
  const next = !isMuted();
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* swallow — private mode, etc. */
  }
  // Broadcast so listeners (TopNav icon) can re-render.
  window.dispatchEvent(new CustomEvent("metu-mute-change", { detail: next }));
  return next;
}

/** Play a single sine tone with a short attack/decay envelope. */
function tone(
  context: AudioContext,
  freq: number,
  duration: number,
  {
    delay = 0,
    type = "sine",
    peakGain = 0.16,
  }: { delay?: number; type?: OscillatorType; peakGain?: number } = {},
) {
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Play a preset cue. No-op if muted or if the context can't be created. */
export function play(cue: CueName) {
  if (isMuted()) return;
  const context = getCtx();
  if (!context) return;
  // Resume a suspended context (browser auto-pause policy).
  if (context.state === "suspended") context.resume().catch(() => {});

  switch (cue) {
    case "cart": {
      // Short upward chirp — feels like "pop into bag".
      tone(context, 660, 0.08);
      tone(context, 990, 0.12, { delay: 0.06 });
      break;
    }
    case "success": {
      // Three-note ascending triad — C5, E5, G5.
      tone(context, 523.25, 0.18);
      tone(context, 659.26, 0.18, { delay: 0.1 });
      tone(context, 783.99, 0.28, { delay: 0.2, peakGain: 0.2 });
      break;
    }
    case "review": {
      // Gentle ding.
      tone(context, 880, 0.22, { peakGain: 0.12 });
      tone(context, 1318, 0.28, { delay: 0.08, peakGain: 0.1 });
      break;
    }
    case "error": {
      // Low buzz — square wave feels more "wrong".
      tone(context, 180, 0.22, { type: "square", peakGain: 0.12 });
      break;
    }
    case "click": {
      // Tiny tick for nav clicks — rarely used, kept optional.
      tone(context, 1400, 0.04, { peakGain: 0.08 });
      break;
    }
  }
}
