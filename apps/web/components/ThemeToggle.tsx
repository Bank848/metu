"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Theme toggle — flips html.dark ↔ html.light and persists to
 * localStorage. The site is dark-first, so the default (no preference
 * stored) keeps the dark class server-rendered in `app/layout.tsx`.
 *
 * To prevent a flash of the wrong theme on hard reload, a tiny inline
 * script in the layout reads localStorage before React hydrates and
 * applies the saved class. This component just keeps the React state +
 * localStorage in sync after that.
 *
 * Like `<SoundToggle>`, this accepts `inCluster` so the TopNav can
 * render it as one of three nested buttons inside the shared control
 * cluster shell. Standalone usage falls back to the original pill.
 */
const STORAGE_KEY = "metu-theme";

type Theme = "dark" | "light";

function readStored(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
}

export function ThemeToggle({
  className,
  inCluster = false,
}: {
  className?: string;
  inCluster?: boolean;
}) {
  // Mount-gate to avoid the SSR/CSR mismatch — server renders the dark
  // icon, client picks up the actual stored theme on mount.
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(readStored());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.toggle("light", next === "light");
      root.classList.toggle("dark", next === "dark");
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  // Render the same Moon icon for SSR + first paint so hydration matches.
  // Once mounted we render the correct icon for the active theme.
  const isLight = mounted && theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        inCluster
          ? "flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:text-white hover:bg-white/10 transition"
          : "relative h-9 w-9 rounded-full border border-line bg-space-900 text-ink-secondary hover:text-brand-yellow hover:border-brand-yellow/40 transition flex items-center justify-center",
        className,
      )}
    >
      {isLight ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/**
 * Inline script — set the right `html.light/dark` class BEFORE React
 * hydrates so the page never flashes the wrong palette. Mount in
 * `<head>` of the root layout.
 */
export const themeBootstrapScript = `
(function(){try{
  var t = localStorage.getItem('${STORAGE_KEY}');
  var root = document.documentElement;
  if (t === 'light') { root.classList.add('light'); root.classList.remove('dark'); }
  else { root.classList.add('dark'); root.classList.remove('light'); }
}catch(_){}
})();
`;
