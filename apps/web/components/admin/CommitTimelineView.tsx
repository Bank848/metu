"use client";
import { useMemo, useState } from "react";
import {
  Sparkles,
  Bug,
  Wrench,
  Database,
  FileText,
  TestTube,
  Settings,
  GitCommit,
  Zap,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { COMMIT_TIMELINE, type CommitNode } from "@/lib/admin/commit-timeline";

/**
 * Vertical commit timeline. A single thin spine runs down the left
 * margin; every commit hangs off it as a row, in reverse-chronological
 * order. Day dividers break the spine into sections so a long history
 * stays scannable.
 *
 * Reads left → top down: latest commit at the top, oldest at the bottom.
 * Each row links to the GitHub diff.
 */

const REPO_URL = "https://github.com/Bank848/metu";

const TYPE_STYLE: Record<
  string,
  { dot: string; chip: string; icon: LucideIcon; label: string }
> = {
  feat: { dot: "bg-mint", chip: "bg-mint/15 text-mint border-mint/40", icon: Sparkles, label: "feature" },
  fix: { dot: "bg-coral", chip: "bg-coral/15 text-coral border-coral/40", icon: Bug, label: "fix" },
  docs: { dot: "bg-sky-400", chip: "bg-sky-400/15 text-sky-300 border-sky-400/40", icon: FileText, label: "docs" },
  refactor: { dot: "bg-purple-400", chip: "bg-purple-400/15 text-purple-300 border-purple-400/40", icon: Wrench, label: "refactor" },
  test: { dot: "bg-amber-400", chip: "bg-amber-400/15 text-amber-300 border-amber-400/40", icon: TestTube, label: "test" },
  chore: { dot: "bg-slate-400", chip: "bg-slate-400/15 text-slate-300 border-slate-400/40", icon: Settings, label: "chore" },
  data: { dot: "bg-indigo-400", chip: "bg-indigo-400/15 text-indigo-300 border-indigo-400/40", icon: Database, label: "data" },
  perf: { dot: "bg-yellow-400", chip: "bg-yellow-400/15 text-yellow-300 border-yellow-400/40", icon: Zap, label: "perf" },
  tools: { dot: "bg-slate-400", chip: "bg-slate-400/15 text-slate-300 border-slate-400/40", icon: Settings, label: "tools" },
  other: { dot: "bg-white/40", chip: "bg-white/8 text-ink-secondary border-white/20", icon: GitCommit, label: "other" },
};

function styleFor(type: string) {
  return TYPE_STYLE[type] ?? TYPE_STYLE.other;
}

export function CommitTimelineView() {
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Newest first.
  const ordered = useMemo(() => {
    return [...COMMIT_TIMELINE].sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));
  }, []);

  const visible = useMemo(() => {
    return ordered.filter((c) => {
      if (filter && c.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.subject.toLowerCase().includes(q) &&
          !c.shortSha.includes(q) &&
          !c.author.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [ordered, filter, search]);

  // Group by day so the spine has clear chapter breaks.
  const days = useMemo(() => {
    const m = new Map<string, CommitNode[]>();
    for (const c of visible) {
      const key = c.dateIso.slice(0, 10); // YYYY-MM-DD
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return Array.from(m.entries());
  }, [visible]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of ordered) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [ordered]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject, SHA, or author…"
          className="flex-1 min-w-64 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            !filter
              ? "bg-metu-yellow text-space-black"
              : "bg-white/5 text-ink-dim hover:text-white"
          }`}
        >
          All ({ordered.length})
        </button>
        {types.map(([t, n]) => {
          const s = styleFor(t);
          const active = filter === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(active ? null : t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? s.chip : "border-white/10 bg-white/5 text-ink-dim hover:text-white"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label} ({n})
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-dim">
        Showing <span className="text-white font-semibold">{visible.length}</span> of {ordered.length} commits.
        Newest first. Click a row to open the diff on GitHub.
      </p>

      {/* Vertical timeline */}
      {days.length === 0 ? (
        <p className="text-center text-sm text-ink-dim py-12">No commits match this filter.</p>
      ) : (
        <div className="relative pl-8">
          {/* Continuous spine — single vertical line down the entire list */}
          <div
            aria-hidden
            className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-metu-yellow/0 via-metu-yellow/40 to-metu-yellow/0"
          />

          {days.map(([day, commits], dayIdx) => (
            <DaySection key={day} day={day} commits={commits} isFirst={dayIdx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function DaySection({
  day,
  commits,
  isFirst,
}: {
  day: string;
  commits: CommitNode[];
  isFirst: boolean;
}) {
  const dateLabel = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <section className={isFirst ? "" : "pt-6"}>
      {/* Day header — anchors to the spine with a ring */}
      <div className="relative mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className="absolute -left-[18px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-metu-yellow ring-4 ring-space-black"
        />
        <span className="rounded-full bg-metu-yellow/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-metu-yellow">
          {dateLabel}
        </span>
        <span className="text-xs text-ink-dim">
          {commits.length} commit{commits.length === 1 ? "" : "s"}
        </span>
      </div>

      <ol className="space-y-2">
        {commits.map((c) => (
          <CommitRow key={c.sha} commit={c} />
        ))}
      </ol>
    </section>
  );
}

function CommitRow({ commit }: { commit: CommitNode }) {
  const s = styleFor(commit.type);
  const time = new Date(commit.dateIso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const url = `${REPO_URL}/commit/${commit.sha}`;
  // Strip the conventional-commits prefix from the displayed subject so
  // the chip on the left carries the type and the title is just the
  // human-readable change.
  const cleanSubject = commit.subject.replace(/^[a-z]+(?:\([^)]+\))?(?:!)?:\s*/i, "");

  return (
    <li className="relative">
      {/* Tiny dot on the spine */}
      <span
        aria-hidden
        className={`absolute -left-[14px] top-3.5 h-1.5 w-1.5 rounded-full ${s.dot}`}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.04]"
      >
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.chip}`}>
          <s.icon className="h-3 w-3" />
          {s.label}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm text-white leading-snug">{cleanSubject}</div>
          <div className="mt-1 text-[11px] text-ink-dim flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{commit.shortSha}</span>
            <span>·</span>
            <span>{time}</span>
            <span>·</span>
            <span>{commit.author}</span>
          </div>
        </div>

        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-dim opacity-0 group-hover:opacity-100 transition" />
      </a>
    </li>
  );
}
