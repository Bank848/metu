import { Tag } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/server/prisma";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Tags · Admin · METU" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchParams {
  page?: string;
  q?: string;
}

interface Row {
  tag_id: number;
  tag_name: string;
  product_count: bigint;
  last_used_at: Date | null;
}

export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = (searchParams.q ?? "").trim();
  const offset = (page - 1) * PAGE_SIZE;

  // One query, two aggregates, ranked by usage. ILIKE search optional.
  const where = q ? `WHERE t.tag_name ILIKE '%' || $1 || '%'` : "";
  const params: string[] = q ? [q] : [];
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT
       t.tag_id,
       t.tag_name,
       (SELECT COUNT(*)::int FROM product_n_tag pnt WHERE pnt.tag_id = t.tag_id) AS product_count,
       (SELECT MAX(p.updated_at)
          FROM product_n_tag pnt
          JOIN product p ON p.product_id = pnt.product_id
         WHERE pnt.tag_id = t.tag_id) AS last_used_at
     FROM product_tag t
     ${where}
     ORDER BY product_count DESC, t.tag_name ASC
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ...params,
  );
  const totalRow = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    `SELECT COUNT(*)::int AS total FROM product_tag t ${where}`,
    ...params,
  );
  const total = Number(totalRow[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    return `/admin/tags?${params.toString()}`;
  };

  return (
    <main className="px-8 py-8 max-w-4xl space-y-6">
      <PageHeader
        title="Tags"
        subtitle={`${total.toLocaleString()} tags across the platform · ranked by usage`}
      />

      {/* Search bar */}
      <form action="/admin/tags" method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search tag name…"
          className="flex-1 rounded-xl border border-line bg-space-950 px-4 py-2 text-sm text-white focus:border-metu-yellow outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-metu-yellow px-4 py-2 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90"
        >
          Search
        </button>
        {q && (
          <Link href="/admin/tags" className="rounded-full border border-line px-4 py-2 text-sm text-ink-secondary hover:border-metu-yellow">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No tags match"
          description={q ? "Try a different search term." : "Tags will appear here as products are tagged."}
          icon={<Tag className="h-8 w-8" />}
        />
      ) : (
        <section className="rounded-2xl border border-line bg-space-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-space-950 text-xs uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Tag</th>
                <th className="text-right px-4 py-2 font-medium">Products tagged</th>
                <th className="text-right px-4 py-2 font-medium">Last used</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const used = Number(r.product_count) > 0;
                return (
                  <tr key={r.tag_id} className="border-t border-line hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Badge variant="mist">{r.tag_name}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-mono">
                      {Number(r.product_count).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-dim">
                      {r.last_used_at ? fmtDate(r.last_used_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {used
                        ? <Badge variant="success">In use</Badge>
                        : <Badge variant="mist">Unused</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm">
          <span className="text-ink-dim">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: String(page + 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
