"use client";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export function SearchPill({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

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
      <label
        className={`relative flex items-center rounded-pill bg-surface-3/80 backdrop-blur transition border ${
          focused
            ? "border-metu-yellow/60 ring-2 ring-metu-yellow/30"
            : "border-white/8 hover:border-white/15"
        }`}
      >
        <span className="pl-4 text-ink-dim">
          <Search className="h-4 w-4" aria-hidden />
        </span>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("nav.search.placeholder")}
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
        <kbd className="mr-3 hidden md:inline-flex items-center rounded border border-white/10 bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink-dim">
          /
        </kbd>
      </label>
    </form>
  );
}
