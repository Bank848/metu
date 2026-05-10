"use client";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

export type TagOption = {
  tagId: number;
  tagName: string;
  productCount: number;
};

interface TagInputProps {
  selected: string[];
  onChange: (names: string[]) => void;
  options: TagOption[];
  maxTags?: number;
}

const MAX = 10;
const NAME_LIMIT = 30;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function normalize(name: string): string {
  return name.trim().toLowerCase().slice(0, NAME_LIMIT);
}

export default function TagInput({
  selected,
  onChange,
  options,
  maxTags = MAX,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [limitError, setLimitError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(
    () => new Set(selected.map((n) => n.toLowerCase())),
    [selected],
  );

  // Top-5 matches by productCount, prefix preferred, excluding selected.
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (o) =>
          !selectedSet.has(o.tagName.toLowerCase()) &&
          o.tagName.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const aStarts = a.tagName.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.tagName.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return b.productCount - a.productCount;
      })
      .slice(0, 5);
  }, [input, options, selectedSet]);

  function flashLimit() {
    setLimitError(true);
    setTimeout(() => setLimitError(false), 3000);
  }

  function addName(rawName: string) {
    const name = normalize(rawName);
    if (!name) {
      setInput("");
      return;
    }
    if (selectedSet.has(name)) {
      setInput("");
      return;
    }
    if (selected.length >= maxTags) {
      flashLimit();
      return;
    }
    onChange([...selected, name]);
    setInput("");
    setActiveIdx(0);
  }

  function commitFromInput() {
    if (suggestions.length > 0) {
      addName(suggestions[Math.min(activeIdx, suggestions.length - 1)]!.tagName);
      return;
    }
    // Free-form path: typed text becomes a brand-new tag. Server
    // resolveTagIds() will insert it into product_tag if it's never
    // been seen before.
    addName(input);
  }

  function removeName(name: string) {
    onChange(selected.filter((n) => n.toLowerCase() !== name.toLowerCase()));
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value.slice(0, NAME_LIMIT));
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitFromInput();
            } else if (e.key === "Backspace" && !input && selected.length > 0) {
              onChange(selected.slice(0, -1));
            } else if (e.key === "ArrowDown" && suggestions.length > 0) {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp" && suggestions.length > 0) {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            }
          }}
          placeholder={
            selected.length >= maxTags
              ? "Tag limit reached"
              : "Type tag name (Enter to add new or pick a suggestion)"
          }
          disabled={selected.length >= maxTags}
          maxLength={NAME_LIMIT}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-zinc-600"
        />

        {(suggestions.length > 0 || (input.trim() && !suggestions.some((s) => s.tagName.toLowerCase() === input.trim().toLowerCase()))) && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
            {suggestions.map((s, i) => (
              <button
                key={s.tagId}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addName(s.tagName);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm transition ${
                  i === activeIdx
                    ? "bg-amber-400/15 text-amber-200"
                    : "text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <span className="font-semibold">{s.tagName}</span>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {formatCount(s.productCount)}
                </span>
              </button>
            ))}
            {input.trim() && !suggestions.some((s) => s.tagName.toLowerCase() === input.trim().toLowerCase()) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addName(input);
                }}
                className="w-full flex items-center justify-between px-4 py-2 text-left text-sm border-t border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-mint"
              >
                <span className="font-semibold">+ Create &quot;{normalize(input)}&quot;</span>
                <span className="text-[11px] text-zinc-500">new tag</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between min-h-[16px]">
        {limitError ? (
          <p className="text-xs text-red-500 font-semibold transition-opacity duration-200">
            ✕ Maximum {maxTags} tags
          </p>
        ) : (
          <p className="text-[10px] text-zinc-600 transition-opacity duration-200">
            {selected.length === 0
              ? "Enter or comma adds the highlighted suggestion or creates a new tag"
              : `${maxTags - selected.length} remaining · Backspace to remove last`}
          </p>
        )}

        <span
          className={`text-xs font-black tabular-nums transition-colors ${
            selected.length >= maxTags
              ? "text-red-500"
              : selected.length >= maxTags - 3
                ? "text-amber-400"
                : "text-zinc-500"
          }`}
        >
          {selected.length}/{maxTags}
        </span>
      </div>

      {selected.length > 0 && (
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 min-h-[44px]">
            {selected.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 pl-1 pr-2.5 py-1 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-full border border-zinc-700 transition-transform duration-150 animate-fade-in-up"
              >
                <button
                  type="button"
                  onClick={() => removeName(name)}
                  aria-label={`Remove ${name}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-500/60 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
