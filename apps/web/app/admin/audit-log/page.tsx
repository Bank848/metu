import Link from "next/link";
import { ClipboardList, Activity, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/StatCard";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { getAdminAuditLog } from "@/lib/server/queries";

type Row = Awaited<ReturnType<typeof getAdminAuditLog>>["items"][number];

export const dynamic = "force-dynamic";

const columns: DataTableColumn<Row>[] = [
  { key: "when",    header: "When" },
  { key: "actor",   header: "Actor" },
  { key: "action",  header: "Action" },
  { key: "target",  header: "Target" },
  { key: "ip",      header: "IP" },
  { key: "meta",    header: "Meta" },
];

const fmtBangkok = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function actionTone(action: string): "success" | "warning" | "danger" | "mist" {
  if (action.endsWith(".fail") || action.endsWith(".denied") || action.includes("error")) return "danger";
  if (action.includes("delete") || action.includes("ban") || action.includes("suspend")) return "warning";
  if (action.endsWith(".success") || action.endsWith(".ok")) return "success";
  return "mist";
}

function truncate(s: string, max = 80) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export default async function AdminAuditLog({
  searchParams,
}: {
  searchParams: {
    actorEmail?: string;
    action?: string;
    outcome?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const data = await getAdminAuditLog({
    actorEmail: searchParams.actorEmail,
    action: searchParams.action,
    outcome: searchParams.outcome,
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(searchParams.to + "T23:59:59") : undefined,
    page,
  });

  const rows = data.items;
  const failCount = rows.filter((r) => r.action.endsWith(".fail") || r.action.endsWith(".denied")).length;
  const distinctActors = new Set(rows.map((r) => r.actorId).filter((id): id is number => id !== null)).size;
  const distinctActions = new Set(rows.map((r) => r.action)).size;

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/audit-log${p.toString() ? "?" + p.toString() : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${data.total.toLocaleString()} events · viewing page ${data.page}/${data.totalPages} · 100 per page · Asia/Bangkok timezone`}
      />

      <form action="/admin/audit-log" method="get" className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <input
          name="actorEmail"
          defaultValue={searchParams.actorEmail ?? ""}
          placeholder="Actor email…"
          className="md:col-span-2 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <input
          name="action"
          defaultValue={searchParams.action ?? ""}
          placeholder='Action prefix (e.g. "auth.login")'
          className="md:col-span-2 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <select
          name="outcome"
          defaultValue={searchParams.outcome ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Any outcome</option>
          <option value="ok">ok / success</option>
          <option value="fail">fail / denied</option>
        </select>
        <button className="rounded-full bg-metu-yellow text-space-black px-4 py-2 text-sm font-bold">
          Apply
        </button>
        <input
          type="date"
          name="from"
          defaultValue={searchParams.from ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          name="to"
          defaultValue={searchParams.to ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        />
      </form>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard variant="highlight" icon={ClipboardList} label="Events on page" value={rows.length} />
        <StatCard icon={Activity} label="Distinct actors" value={distinctActors} />
        <StatCard
          icon={AlertTriangle}
          label="Fails / denied (page)"
          value={failCount}
          variant={failCount > 0 ? "default" : "zero"}
        />
      </div>

      <DataTable<Row>
        ariaLabel="Audit log"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.logId}
        emptyState={
          <EmptyState
            variant="noResults"
            title="No audit events match these filters"
            description="Try clearing the action prefix or widening the date range."
          />
        }
        renderCell={(r, col) => {
          switch (col.key) {
            case "when":
              return (
                <span className="font-mono text-xs text-ink-dim whitespace-nowrap">
                  {fmtBangkok.format(r.createdAt)}
                </span>
              );
            case "actor":
              return r.actor ? (
                <div className="text-sm">
                  <div className="text-white truncate max-w-[180px]">
                    {r.actor.firstName} {r.actor.lastName}
                  </div>
                  <div className="text-xs text-ink-dim truncate max-w-[180px]">{r.actor.email}</div>
                </div>
              ) : (
                <span className="text-xs text-ink-dim italic">system</span>
              );
            case "action":
              return (
                <Badge variant={actionTone(r.action)} className="font-mono text-[10px]">
                  {r.action}
                </Badge>
              );
            case "target":
              return (
                <span className="font-mono text-xs text-ink-secondary">
                  {r.targetType}#{r.targetId}
                </span>
              );
            case "ip":
              return (
                <span className="font-mono text-[10px] text-ink-dim">{r.ipAddress ?? "—"}</span>
              );
            case "meta": {
              const j = r.meta == null ? "" : JSON.stringify(r.meta);
              if (!j) return <span className="text-xs text-ink-dim">—</span>;
              return (
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-secondary hover:text-white font-mono">
                    {truncate(j, 60)}
                  </summary>
                  <pre className="mt-2 max-w-md overflow-x-auto rounded bg-space-950 border border-line p-2 text-[10px] text-ink-secondary whitespace-pre-wrap break-all">
                    {JSON.stringify(r.meta, null, 2)}
                  </pre>
                </details>
              );
            }
            default:
              return null;
          }
        }}
      />

      {data.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm mt-4">
          <span className="text-ink-dim">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Link href={buildHref({ page: String(data.page - 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                ← Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link href={buildHref({ page: String(data.page + 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
