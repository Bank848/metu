"use client";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_PLACEHOLDERS = [
  "10,000 Robux Giftcard | Roblox",
  "Neo-Tokyo Environment Kit",
  "Ultima UI System v2.0",
  "Mech-Suit Master Concept",
  "Cyberpunk Audio Pack Vol.3",
  "Neon City Shader Bundle",
  "Pro UI Templates 2024",
  "Holographic Display Assets",
];

const PLACEHOLDER_INTERVAL = 5000;

export function SearchPill({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animated placeholder state
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

  // "/" shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Cycle placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
        setPlaceholderVisible(true);
      }, 300);
    }, PLACEHOLDER_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  function clear() {
    setQ("");
    inputRef.current?.focus();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : "/browse");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-[640px] shrink-0"
      role="search"
    >
      <div className="flex items-center h-[42px] bg-metu-secondary rounded-[105px] px-[28px] gap-[20px] overflow-hidden">
        {/* Search icon */}
        <Search
          className="text-metu-yellow shrink-0 h-5 w-5"
          aria-hidden
        />

        {/* Input + animated placeholder */}
        <div className="relative flex-1 h-full flex items-center overflow-hidden">
          {/* Animated placeholder — hidden when user has typed */}
          {!q && (
            <span
              className="absolute inset-0 flex items-center text-white/50 font-gotham text-[16px] pointer-events-none select-none transition-all duration-300 whitespace-nowrap"
              style={{
                opacity: placeholderVisible ? 1 : 0,
                transform: placeholderVisible ? "translateY(0)" : "translateY(-8px)",
              }}
            >
              {SEARCH_PLACEHOLDERS[placeholderIndex]}
            </span>
          )}
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="relative flex-1 bg-transparent border-none focus:outline-none text-white font-gotham text-[16px] w-full z-10"
            autoComplete="off"
            aria-label={"Search placeholder"}
          />
        </div>

        {/* Clear button */}
        {q && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="shrink-0 p-1 rounded-full text-white/50 hover:text-white transition-colors"
          >
            
          </button>
        )}
      </div>
    </form>
  );
}