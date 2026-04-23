import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ───── Friend's neo-luxury palette (primary tokens) ─────
        metu: {
          yellow:    "#FFCC00",
          yellowDim: "#ECB200",
          gold:      "#B26800",
          goldDeep:  "#3D2B00",
          red:       "#FF2C2C",
        },
        surface: {
          1: "#0E0E0E", // base
          2: "#1A1919", // raised card
          3: "#201F1F", // hover / nested
          4: "#262626", // emphasis
          5: "#2E2E2E",
        },
        outline: {
          DEFAULT: "#767575",
          variant: "#484847",
          soft:    "rgba(255,255,255,0.06)",
        },
        ink: {
          primary:   "#FAFAFA",
          secondary: "rgba(255,255,255,0.72)",
          dim:       "rgba(255,255,255,0.48)",
          mute:      "rgba(255,255,255,0.28)",
        },

        // ───── Legacy aliases (back-compat with v1 components) ─────
        space: {
          black: "#0E0E0E",
          950:   "#1A1919",
          900:   "#1A1919",
          850:   "#201F1F",
          800:   "#262626",
          700:   "#2E2E2E",
          600:   "#3A3A3A",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.06)",
          soft:    "rgba(255,255,255,0.04)",
          bright:  "rgba(255,255,255,0.14)",
        },
        brand: {
          yellow:     "#FFCC00",
          yellowDark: "#ECB200",
          yellowSoft: "#FFE99C",
          gold:       "#B26800",
          goldDeep:   "#3D2B00",
          charcoal:   "#1A1919",
          ink:        "#0E0E0E",
          mist:       "#262626",
        },

        // ───── Wave-1 secondary + tertiary accents (NEW, Phase 9) ─────
        // See docs/design-system.md §2.2/§2.3 for the rationale. The TL;DR:
        //   - mint  = success / "live" / positive deltas. Cool counterpart
        //             to gold, retires the ad-hoc `green-500/15` we sprinkle
        //             in Badge.tsx.
        //   - coral = soft alerts / "new" / "trending up". Warm but in a
        //             different register from gold, and crucially distinct
        //             from `metu-red` which stays destructive-only.
        // Both are scale-of-three (DEFAULT / dim / deep) to mirror the
        // `metu-yellow` family — keeps the mental model consistent.
        mint: {
          DEFAULT: "#6EE7B7",
          dim:     "#34D399",
          deep:    "#047857",
        },
        coral: {
          DEFAULT: "#FB7185",
          dim:     "#F43F5E",
          deep:    "#881337",
        },
      },
      fontFamily: {
        // Use CSS-vars set by next/font in layout.tsx, fall back to system stack.
        display: ["var(--font-display)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        body:    ["var(--font-body)", "Manrope", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
        // Thai-specific stack. The `--font-thai` var is reserved here so
        // Wave-2 can wire `next/font/google`'s Prompt loader in layout.tsx
        // without another tailwind change. Until then this falls back to
        // Prompt-from-system / Manrope, which still renders Thai correctly
        // (just without the font-loading optimisation).
        thai:    ["var(--font-thai)", "Prompt", "var(--font-body)", "Manrope", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Tighter blur radii — large blurs (>20px) compound badly when many
        // cards transition simultaneously on hover. We keep the visual
        // weight by bumping opacity slightly instead.
        card: "0 4px 14px -4px rgba(0,0,0,0.5)",
        pop:  "0 6px 18px -8px rgba(255, 204, 0, 0.55)",
        glow: "0 0 0 1px rgba(255,204,0,0.4), 0 0 14px -4px rgba(255,204,0,0.35)",
        gold: "0 4px 16px -8px rgba(178, 104, 0, 0.6)",

        // ───── Wave-1 elevation scale (NEW, Phase 9) ─────
        // Decoupled from the gold accent so non-gold contexts (mint cards,
        // editorial breakouts, neutral modals) have an idiomatic shadow.
        // Three rungs is plenty — flat → raised → floating. Anything more
        // exotic (e.g. inset, ring) should be expressed inline.
        flat:     "0 1px 0 rgba(0,0,0,0.4)",
        raised:   "0 6px 20px -8px rgba(0,0,0,0.55)",
        floating: "0 18px 40px -16px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        "button-gradient":  "linear-gradient(180deg, #FFCC00 0%, #B26800 100%)",
        "gold-radial":      "radial-gradient(ellipse at top right, rgba(178,104,0,0.55), transparent 55%)",
        "vibrant-mesh":     "radial-gradient(60% 80% at 30% 20%, rgba(255,204,0,0.18) 0, transparent 60%), radial-gradient(50% 70% at 80% 70%, rgba(178,104,0,0.22) 0, transparent 60%), linear-gradient(180deg, #0E0E0E 0%, #1A1919 100%)",
        "hero-radial":      "linear-gradient(109.38deg, #161616 8.65%, #6D581D 79.46%)",
        "tungsten-fade":    "radial-gradient(ellipse at top right, rgba(178,104,0,0.20), transparent 55%)",
        "dot-grid":         "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)",
        "star-field":       "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.45) 0, transparent 50%), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.35) 0, transparent 50%), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.30) 0, transparent 50%)",
        "stars-md":         "radial-gradient(1.2px 1.2px at 12% 18%, rgba(255,255,255,0.5) 0, transparent 50%), radial-gradient(1px 1px at 64% 38%, rgba(255,255,255,0.4) 0, transparent 50%), radial-gradient(1.4px 1.4px at 33% 72%, rgba(255,255,255,0.55) 0, transparent 50%), radial-gradient(1px 1px at 88% 84%, rgba(255,255,255,0.35) 0, transparent 50%), radial-gradient(1.2px 1.2px at 52% 12%, rgba(255,255,255,0.45) 0, transparent 50%)",
      },
      backgroundSize: {
        "dot-grid": "26px 26px",
      },
      borderRadius: {
        // `pill` already exists — Tailwind's defaults supply the rest of
        // the scale (none/sm/md/lg/xl/2xl/3xl/full). We document the usage
        // contract in docs/design-system.md §4 so the scale stops being
        // "rounded-2xl on everything." Adding `pill` here would be
        // redundant if Tailwind owned it, but the friend's reference uses
        // an unusually large 118px pill so we keep the override.
        pill: "118px",
      },
      keyframes: {
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "twinkle": {
          "0%, 100%": { opacity: "0.3" },
          "50%":      { opacity: "1" },
        },
        // Light-sweep shimmer for hero text.
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Slow rotating border for gradient-border CTAs.
        "border-spin": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // Wave-1 stagger reveal — see globals.css for the duplicate
        // declaration. We declare it here too so Tailwind generates the
        // `animate-stagger-rise` utility; the CSS copy exists so plain
        // CSS surfaces (which can't use Tailwind's animation helper)
        // can reference the same keyframe by name.
        "stagger-rise": {
          "0%":   { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up":   "fade-in-up 0.4s ease-out",
        "twinkle":      "twinkle 4s ease-in-out infinite",
        "shimmer":      "shimmer 3s linear infinite",
        "border-spin":  "border-spin 6s linear infinite",
        "stagger-rise": "stagger-rise 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
