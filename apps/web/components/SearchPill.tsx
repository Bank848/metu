"use client";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SearchPill({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep in sync when route changes (e.g. nav from another page with ?q=)
  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

  // Keyboard shortcut: "/" focuses the search pill (ignore when typing elsewhere)
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
      className="flex-1 min-w-0 max-w-[640px] relative"
      role="search"
    >
      <label className="relative flex items-center rounded-full bg-space-800 border border-line hover:border-line-bright focus-within:border-brand-yellow focus-within:ring-2 focus-within:ring-brand-yellow/30 transition">
        <span className="pl-4 text-ink-dim">
          <Search className="h-4 w-4" aria-hidden />
        </span>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search templates, courses, music, creators…"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-ink-dim focus:outline-none"
          autoComplete="off"
        />
        {q && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="mr-1 p-1.5 rounded-full text-ink-dim hover:text-white hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="mr-3 hidden md:inline-flex items-center rounded border border-line bg-space-900 px-1.5 py-0.5 text-[10px] font-mono text-ink-dim">
          /
        </kbd>
      </label>
    </form>
  );
}
