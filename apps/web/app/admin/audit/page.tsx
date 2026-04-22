import Image from "next/image";
import Link from "next/link";
import { History, Filter } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/server/prisma";
import { isDataUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Action prefix → badge tone. Keeps the visual cue consistent with the
// destructive-action vocabulary we standardised in lib/server/audit.ts.
function toneFor(action: string): "yellow" | "purple" | "info" | "success" | "mist" {
  if (action.endsWith(".delete")) return "purple";
  if (action.endsWith(".refund")) return "yellow";
  if (action.endsWith(".role_change")) return "info";
  if (action.endsWith(".fulfilled")) return "success";
  return "mist";
}

type SearchParams = Record<string, string | undefined>;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const action = searchParams.action || undefined;
  const targetType = searchParams.targetType || undefined;

  const where = {
    ...(action ? { action } : {}),
    ...(targetType ? { targetType } : {}),
  };

  const [entries, total, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        actor: {
          select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
    // Pull every distinct action that's ever been logged so the filter
    // chips reflect actual data rather than a stale hard-coded list.
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Partial<SearchParams>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...overrides })) {
      if (v) p.set(k, v);
    }
    return `/admin/audit?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`Every destructive admin and seller action, in reverse chronological order. ${total.toLocaleString()} entries.`}
      />

      {/* Filter bar — action chips + target-type pills. Clicking the
          active chip clears the filter (toggle behaviour). */}
      <div className="mb-6 rounded-2xl border border-line bg-space-850 p-5 space-y-4">
        <div>
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-2 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" /> Action
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link href={buildHref({ action: undefined })}>
              <Badge variant={!action ? "yellow" : "mist"}>All actions</Badge>
            </Link>
            {distinctActions.map((a) => (
              <Link
                key={a.action}
                href={buildHref({ action: action === a.action ? undefined : a.action })}
              >
                <Badge variant={action === a.action ? "yellow" : "mist"}>{a.action}</Badge>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-2">
            Target type
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link href={buildHref({ targetType: undefined })}>
              <Badge variant={!targetType ? "yellow" : "mist"}>All targets</Badge>
            </Link>
            {["user", "store", "product", "order", "transaction"].map((t) => (
              <Link
                key={t}
                href={buildHref({ targetType: targetType === t ? undefined : t })}
              >
                <Badge variant={targetType === t ? "yellow" : "mist"}>{t}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No audit entries match those filters"
          description="Try clearing the filters or wait for activity."
          icon={<History className="h-8 w-8" />}
        />
      ) : (
        <section className="rounded-2xl border border-line bg-space-850 overflow-hidden">
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.logId} className="px-6 py-4 flex items-start gap-4">
                <div className="relative h-9 w-9 rounded-full bg-space-900 overflow-hidden shrink-0 border border-line">
                  {e.actor?.profileImage && (
                    <Image
                      src={e.actor.profileImage}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                      unoptimized={isDataUrl(e.actor.profileImage)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={toneFor(e.action)}>{e.action}</Badge>
                    <span className="text-sm text-white font-semibold">
                      {e.actor
                        ? `${e.actor.firstName} ${e.actor.lastName}`
                        : "System"}
                      {e.actor && (
                        <span className="text-ink-dim font-normal"> · @{e.actor.username}</span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-ink-dim mt-1">
                    target: <span className="text-ink-secondary">{e.targetType}</span>#
                    <span className="text-ink-secondary">{e.targetId}</span>
                    {" · "}
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                  {e.meta && (
                    <pre className="mt-2 rounded-lg border border-line bg-space-900 p-3 text-[11px] text-ink-secondary font-mono overflow-x-auto">
                      {JSON.stringify(e.meta, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildHref({ page: String(page - 1) })}
              className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-brand-yellow/50"
            >
              ← Prev
            </Link>
          )}
          <span className="px-4 text-sm text-ink-secondary">
            Page <span className="text-white font-semibold">{page}</span> of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildHref({ page: String(page + 1) })}
              className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-brand-yellow/50"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
