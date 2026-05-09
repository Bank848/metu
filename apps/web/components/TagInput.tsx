"use client";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export type TagOption = {
  tagId: number;
  tagName: string;
  productCount: number;
};

interface TagInputProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  options: TagOption[];
  maxTags?: number;
}

const MAX = 10;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export default function TagInput({
  selectedIds,
  onChange,
  options,
  maxTags = MAX,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [limitError, setLimitError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(options.map((o) => [o.tagId, o])), [options]);
  const selectedOptions = selectedIds
    .map((id) => byId.get(id))
    .filter((o): o is TagOption => Boolean(o));

  // Top-5 matches by productCount, prefix match preferred, excluding already-selected.
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(selectedIds);
    return options
      .filter((o) => !taken.has(o.tagId) && o.tagName.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.tagName.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.tagName.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return b.productCount - a.productCount;
      })
      .slice(0, 5);
  }, [input, options, selectedIds]);

  function flashLimit() {
    setLimitError(true);
    setTimeout(() => setLimitError(false), 3000);
  }

  function addById(tagId: number) {
    if (selectedIds.includes(tagId)) {
      setInput("");
      return;
    }
    if (selectedIds.length >= maxTags) {
      flashLimit();
      return;
    }
    onChange([...selectedIds, tagId]);
    setInput("");
    setActiveIdx(0);
  }

  function commitFromInput() {
    if (suggestions.length > 0) {
      addById(suggestions[Math.min(activeIdx, suggestions.length - 1)]!.tagId);
      return;
    }
    // Exact-match fallback: if the typed text matches a tagName precisely,
    // accept it even though no autocomplete matches surfaced.
    const exact = options.find((o) => o.tagName.toLowerCase() === input.trim().toLowerCase());
    if (exact) addById(exact.tagId);
  }

  function removeById(tagId: number) {
    onChange(selectedIds.filter((id) => id !== tagId));
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitFromInput();
            } else if (e.key === "Backspace" && !input && selectedIds.length > 0) {
              onChange(selectedIds.slice(0, -1));
            } else if (e.key === "ArrowDown" && suggestions.length > 0) {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp" && suggestions.length > 0) {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            }
          }}
          placeholder={
            selectedIds.length >= maxTags
              ? "Tag limit reached"
              : "Type to search tags…"
          }
          disabled={selectedIds.length >= maxTags}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-zinc-600"
        />

        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
            {suggestions.map((s, i) => (
              <button
                key={s.tagId}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addById(s.tagId);
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
          </div>
        )}
      </div>

      <div className="flex items-center justify-between min-h-[16px]">
        <AnimatePresence mode="wait">
          {limitError ? (
            <motion.p
              key="error"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-red-500 font-semibold"
            >
              ✕ Maximum {maxTags} tags
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-zinc-600"
            >
              {selectedIds.length === 0
                ? "Enter or comma adds the highlighted suggestion"
                : `${maxTags - selectedIds.length} remaining · Backspace to remove last`}
            </motion.p>
          )}
        </AnimatePresence>

        <span
          className={`text-xs font-black tabular-nums transition-colors ${
            selectedIds.length >= maxTags
              ? "text-red-500"
              : selectedIds.length >= maxTags - 3
                ? "text-amber-400"
                : "text-zinc-500"
          }`}
        >
          {selectedIds.length}/{maxTags}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {selectedOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 min-h-[44px]">
              <AnimatePresence mode="popLayout">
                {selectedOptions.map((tag) => (
                  <motion.span
                    key={tag.tagId}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: -4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="inline-flex items-center gap-1 pl-1 pr-2.5 py-1 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-full border border-zinc-700"
                  >
                    <button
                      type="button"
                      onClick={() => removeById(tag.tagId)}
                      aria-label={`Remove ${tag.tagName}`}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-500/60 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {tag.tagName}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
