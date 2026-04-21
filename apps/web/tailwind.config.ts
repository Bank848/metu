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
      },
      fontFamily: {
        // Use CSS-vars set by next/font in layout.tsx, fall back to system stack.
        display: ["var(--font-display)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        body:    ["var(--font-body)", "Manrope", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 4px 20px -4px rgba(0,0,0,0.45)",
        pop:  "0 8px 32px -8px rgba(255, 204, 0, 0.45)",
        glow: "0 0 0 1px rgba(255,204,0,0.35), 0 0 24px -4px rgba(255,204,0,0.30)",
        gold: "0 6px 24px -8px rgba(178, 104, 0, 0.55)",
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
      },
      animation: {
        "fade-in-up":  "fade-in-up 0.4s ease-out",
        "twinkle":     "twinkle 4s ease-in-out infinite",
        "shimmer":     "shimmer 3s linear infinite",
        "border-spin": "border-spin 6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
