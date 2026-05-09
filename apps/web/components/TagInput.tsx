import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TagInputProps {
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function TagInput({ tags, setTags }: TagInputProps) {
  const [input, setInput] = useState("");
  const [limitError, setLimitError] = useState(false);

  const addTag = useCallback((raw: string) => {
    const label = raw.replace(/^#/, "").trim().toLowerCase();
    if (!label || tags.includes(label)) { setInput(""); return; }
    if (tags.length >= 10) {
      setLimitError(true);
      setTimeout(() => setLimitError(false), 3000);
      return;
    }
    setTags((prev) => [...prev, label]);
    setInput("");
  }, [tags, setTags]);

  return (
    <div className="flex flex-col gap-3 w-full">

      {/* Input */}
      <div className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
            if (e.key === "Backspace" && !input && tags.length > 0) {
              setTags((prev) => prev.slice(0, -1));
            }
          }}
          placeholder={tags.length >= 10 ? "Tag limit reached" : "Type tag and press Enter..."}
          disabled={tags.length >= 10}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-zinc-600"
        />
        {input && (
          <button
            type="button"
            onClick={() => addTag(input)}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-amber-400/15 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded hover:bg-amber-400/25 transition-colors"
          >
            Add ↵
          </button>
        )}
      </div>

      {/* Counter + Error */}
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
              ✕ Maximum 10 tags allowed
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-zinc-600"
            >
              {tags.length === 0 ? "Backspace to remove last tag" : `${10 - tags.length} remaining`}
            </motion.p>
          )}
        </AnimatePresence>

        <span className={`text-xs font-black tabular-nums transition-colors ${
          tags.length >= 10 ? "text-red-500" : tags.length >= 7 ? "text-amber-400" : "text-zinc-500"
        }`}>
          {tags.length}/10
        </span>
      </div>

      {/* Tag List */}
      <AnimatePresence initial={false}>
        {tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 min-h-[44px]">
              <AnimatePresence mode="popLayout">
                {tags.map((label) => (
                  <motion.span
                    key={label}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: -4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-full border border-zinc-700 hover:border-zinc-600 transition-colors"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== label))}
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-600 transition-all text-[9px] leading-none ml-0.5"
                    >
                      ✕
                    </button>
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