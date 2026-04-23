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

type CueName = "cart" | "success" | "review" | "error" | "click" | "purchase";

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

/**
 * Prime the AudioContext on a real user gesture so subsequent async
 * `play()` calls (those fired AFTER an `await fetch(…)` resolves)
 * don't get silently dropped by Chrome's autoplay policy.
 *
 * Background: when `play()` creates a context inside an async
 * callback chain that started from a user click, the gesture window
 * has already closed. The context lands in `suspended` state and
 * `resume()` is a no-op without a fresh gesture. By instantiating +
 * resuming inside the FIRST direct user event, we guarantee a live
 * (running) context exists for every later cue.
 *
 * Safe to call multiple times — `getCtx()` returns the singleton.
 */
export function primeAudio(): void {
  const context = getCtx();
  if (!context) return;
  if (context.state === "suspended") {
    context.resume().catch(() => {
      /* swallow — some browsers reject without a recent gesture */
    });
  }
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
    case "purchase": {
      // Order-success cue — bigger and more theatrical than `success`.
      // C5 → E5 → G5 → C6 ascending arpeggio (a major chord rolled),
      // then a sparkle ding (B6 + D7) on top to feel like the final
      // beat of a confetti burst. Fires from app/orders/[id]/Confetti
      // when ?new=1 is set, so the audio lands the moment confetti
      // starts falling. Total duration ~0.95s — short enough not to
      // outstay its welcome on a re-visit.
      tone(context, 523.25, 0.18);                                       // C5
      tone(context, 659.26, 0.18, { delay: 0.10 });                      // E5
      tone(context, 783.99, 0.22, { delay: 0.20 });                      // G5
      tone(context, 1046.5, 0.30, { delay: 0.32, peakGain: 0.20 });      // C6 — landing
      // Sparkle topper — two short brighter tones (B6, D7) layered over
      // the sustained C6 give the cue a "champagne fizz" finish.
      tone(context, 1975.5, 0.10, { delay: 0.55, peakGain: 0.10 });      // B6
      tone(context, 2349.3, 0.14, { delay: 0.62, peakGain: 0.10 });      // D7
      break;
    }
  }
}
