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
        space: {
          black: "#0A0A0A",
          950:   "#111111",
          900:   "#1A1A1A",
          850:   "#1F1F1F",
          800:   "#242424",
          700:   "#2E2E2E",
          600:   "#3A3A3A",
        },
        ink: {
          primary:   "#FAFAFA",
          secondary: "rgba(255,255,255,0.68)",
          dim:       "rgba(255,255,255,0.42)",
          mute:      "rgba(255,255,255,0.24)",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          soft:    "rgba(255,255,255,0.04)",
          bright:  "rgba(255,255,255,0.14)",
        },
        brand: {
          yellow:     "#FBBF24",
          yellowDark: "#F59E0B",
          yellowSoft: "#FEF3C7",
          gold:       "#D4A84B",
          goldDeep:   "#8B6914",
          // legacy aliases (a few pages still reference these)
          charcoal:   "#1F2937",
          ink:        "#111827",
          mist:       "#F3F4F6",
        },
      },
      fontFamily: {
        display: ["Poppins", "Inter", "system-ui", "sans-serif"],
        body:    ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px -4px rgba(0,0,0,0.45)",
        pop:  "0 8px 32px -8px rgba(251, 191, 36, 0.45)",
        glow: "0 0 0 1px rgba(251,191,36,0.35), 0 0 24px -4px rgba(251,191,36,0.25)",
      },
      backgroundImage: {
        "dot-grid": "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)",
        "star-field": "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.45) 0, transparent 50%), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.35) 0, transparent 50%), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.30) 0, transparent 50%)",
        "tungsten-fade": "radial-gradient(ellipse at top right, rgba(212,168,75,0.18), transparent 55%)",
      },
      backgroundSize: {
        "dot-grid": "26px 26px",
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
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out",
        "twinkle":    "twinkle 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
