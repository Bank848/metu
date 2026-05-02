import type { Metadata } from "next";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CommitTimelineView } from "@/components/admin/CommitTimelineView";
import { COMMIT_TIMELINE } from "@/lib/admin/commit-timeline";

export const metadata: Metadata = { title: "Commit Timeline · Admin · METU" };
export const dynamic = "force-dynamic";

export default function AdminTimelinePage() {
  const total = COMMIT_TIMELINE.length;
  const oldest = COMMIT_TIMELINE.length
    ? COMMIT_TIMELINE[COMMIT_TIMELINE.length - 1].dateIso.slice(0, 10)
    : "—";
  const newest = COMMIT_TIMELINE.length ? COMMIT_TIMELINE[0].dateIso.slice(0, 10) : "—";

  return (
    <>
      <PageHeader
        title="Commit Timeline"
        subtitle={`${total} commits on main · ${oldest} → ${newest}`}
      />
      <p className="mb-4 text-sm text-ink-dim flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-metu-yellow" />
        Fishbone view of every commit on <code className="rounded bg-space-900 px-1.5 py-0.5 text-metu-yellow">main</code>.
        Grouped by month, colour-coded by Conventional Commits prefix
        (feat / fix / docs / refactor / test / chore / data). Click a node
        to open the diff on GitHub.
      </p>
      <CommitTimelineView />
    </>
  );
}
