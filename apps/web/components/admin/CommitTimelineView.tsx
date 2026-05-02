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
  type LucideIcon,
} from "lucide-react";
import { COMMIT_TIMELINE, type CommitNode } from "@/lib/admin/commit-timeline";

/**
 * Fishbone-style commit timeline. A single horizontal spine runs left
 * (oldest) → right (newest). Each commit ribs off the spine, alternating
 * above and below, colour-coded by Conventional Commits type.
 *
 * Click a commit to copy its SHA + open the GitHub diff in a new tab.
 */

const REPO_URL = "https://github.com/Bank848/metu";

const TYPE_STYLE: Record<
  string,
  { bg: string; ring: string; text: string; icon: LucideIcon; label: string }
> = {
  feat: { bg: "bg-mint/15", ring: "ring-mint/40", text: "text-mint", icon: Sparkles, label: "feature" },
  fix: { bg: "bg-coral/15", ring: "ring-coral/40", text: "text-coral", icon: Bug, label: "fix" },
  docs: { bg: "bg-sky-400/15", ring: "ring-sky-400/40", text: "text-sky-300", icon: FileText, label: "docs" },
  refactor: { bg: "bg-purple-400/15", ring: "ring-purple-400/40", text: "text-purple-300", icon: Wrench, label: "refactor" },
  test: { bg: "bg-amber-400/15", ring: "ring-amber-400/40", text: "text-amber-300", icon: TestTube, label: "test" },
  chore: { bg: "bg-slate-400/15", ring: "ring-slate-400/40", text: "text-slate-300", icon: Settings, label: "chore" },
  data: { bg: "bg-indigo-400/15", ring: "ring-indigo-400/40", text: "text-indigo-300", icon: Database, label: "data" },
  perf: { bg: "bg-yellow-400/15", ring: "ring-yellow-400/40", text: "text-yellow-300", icon: Zap, label: "perf" },
  tools: { bg: "bg-slate-400/15", ring: "ring-slate-400/40", text: "text-slate-300", icon: Settings, label: "tools" },
  other: { bg: "bg-white/8", ring: "ring-white/20", text: "text-ink-secondary", icon: GitCommit, label: "other" },
};

function styleFor(type: string) {
  return TYPE_STYLE[type] ?? TYPE_STYLE.other;
}

export function CommitTimelineView() {
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Newest first → oldest last so the user reads left-to-right as
  // most-recent-first when scanning the fishbone visually.
  const ordered = useMemo(() => {
    const list = [...COMMIT_TIMELINE].sort((a, b) =>
      a.dateIso < b.dateIso ? -1 : 1,
    );
    return list;
  }, []);

  const visible = useMemo(() => {
    return ordered.filter((c) => {
      if (filter && c.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.subject.toLowerCase().includes(q) && !c.shortSha.includes(q)) return false;
      }
      return true;
    });
  }, [ordered, filter, search]);

  // Group by month so the spine has chapter labels.
  const months = useMemo(() => {
    const m = new Map<string, CommitNode[]>();
    for (const c of visible) {
      const key = c.dateIso.slice(0, 7); // YYYY-MM
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return Array.from(m.entries()); // [['2026-04', […]], …]
  }, [visible]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of ordered) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [ordered]);

  const totalCommits = ordered.length;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commit message or SHA…"
          className="flex-1 min-w-64 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            !filter ? "bg-metu-yellow text-space-black" : "bg-white/5 text-ink-dim hover:text-white"
          }`}
        >
          All ({totalCommits})
        </button>
        {types.map(([t, n]) => {
          const s = styleFor(t);
          const active = filter === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(active ? null : t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                active ? `${s.bg} ${s.text} ring-1 ${s.ring}` : "bg-white/5 text-ink-dim hover:text-white"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label} ({n})
            </button>
          );
        })}
      </div>

      {/* Fishbone — horizontal spine with commits ribbing off above + below */}
      <div className="relative overflow-x-auto pb-4">
        {months.length === 0 && (
          <p className="text-center text-sm text-ink-dim py-12">No commits match this filter.</p>
        )}
        <div className="flex flex-col">
          {months.map(([month, commits]) => (
            <MonthRow key={month} month={month} commits={commits} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthRow({ month, commits }: { month: string; commits: CommitNode[] }) {
  const [year, mo] = month.split("-");
  const monthLabel = new Date(`${year}-${mo}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <section className="relative">
      {/* Month header */}
      <div className="sticky left-0 z-10 mb-2 inline-flex items-center gap-3">
        <span className="rounded-full bg-metu-yellow/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-metu-yellow">
          {monthLabel}
        </span>
        <span className="text-xs text-ink-dim">{commits.length} commit{commits.length === 1 ? "" : "s"}</span>
      </div>

      {/* Fishbone spine */}
      <div className="relative pl-4 pr-4 py-8">
        {/* Horizontal spine line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-metu-yellow/0 via-metu-yellow/40 to-metu-yellow/0" />

        <ol className="relative flex flex-wrap gap-x-2 gap-y-3 items-center">
          {commits.map((c, idx) => (
            <CommitBone key={c.sha} commit={c} flipDown={idx % 2 === 1} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function CommitBone({ commit, flipDown }: { commit: CommitNode; flipDown: boolean }) {
  const s = styleFor(commit.type);
  const date = new Date(commit.dateIso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = new Date(commit.dateIso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const url = `${REPO_URL}/commit/${commit.sha}`;
  return (
    <li
      className={`relative flex flex-col items-center ${flipDown ? "mt-16" : "-mt-16"}`}
      style={{ minWidth: 220 }}
    >
      {/* Diagonal connector to spine */}
      <span
        aria-hidden
        className={`absolute left-1/2 ${flipDown ? "-top-8" : "-bottom-8"} h-8 w-px bg-white/15`}
      />

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group block w-full rounded-xl border border-white/10 ${s.bg} px-3 py-2 transition hover:scale-[1.02] hover:border-white/30`}
        title={`${commit.subject}\n\n${commit.author} · ${date} ${time}\nSHA: ${commit.sha}\nClick to open on GitHub`}
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <s.icon className={`h-3 w-3 ${s.text}`} />
          <span className={`font-semibold ${s.text}`}>{s.label}</span>
          <span className="ml-auto font-mono text-ink-dim">{commit.shortSha}</span>
        </div>
        <div className="mt-1 text-xs text-white line-clamp-2 leading-snug">
          {commit.subject.replace(/^[a-z]+(?:\([^)]+\))?(?:!)?:\s*/i, "")}
        </div>
        <div className="mt-1 text-[10px] text-ink-dim flex items-center gap-2">
          <span>{date}</span>
          <span>·</span>
          <span>{commit.author}</span>
        </div>
      </a>
    </li>
  );
}
