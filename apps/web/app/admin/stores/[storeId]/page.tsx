import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit3, Package, Star, Banknote, Users, Calendar, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/StatCard";
import { GlassButton } from "@/components/visual/GlassButton";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/server/prisma";
import { fmtDate, fmtDateTime, coins, thbToCoins, coinsCompact } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function fetchAudits(storeId: number) {
  try {
    return await prisma.auditLog.findMany({
      where: {
        OR: [
          { targetType: "store", targetId: storeId },
          { targetType: "product", meta: { path: ["storeId"], equals: storeId } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        actor: { select: { username: true, firstName: true, lastName: true } },
      },
    });
  } catch {
    return [];
  }
}

// Admin store detail page. Renders three sections in one scroll:
//   • Header with avatar, suspend status, owner contact, and the
//     primary "Edit store" CTA (links to ./edit which reuses
//     EditStoreForm with mode="admin").
//   • Stats strip — products, rating, lifetime revenue, joined date.
//   • Products table — every product on the store with a "Edit" row
//     action linking to ./products/[id]/edit (reuses EditProductForm
//     with mode="admin"). Empty state when the store has no products.
//   • Recent activity — last ~10 audit_log entries scoped to this
//     store id (admin actions show up tagged "admin.*", seller
//     self-edits show up untagged so the trail reads like a diff log).
//
// Server-rendered. All queries go straight through prisma — admin
// pages are server components and the role gate happens up-stream in
// `apps/web/middleware.ts`.

export default async function AdminStoreDetailPage({
  params,
}: {
  params: { storeId: string };
}) {
  const storeId = Number(params.storeId);
  if (!Number.isFinite(storeId)) return notFound();

  const [store, products, audits] = await Promise.all([
    prisma.store.findUnique({
      where: { storeId },
      include: {
        businessType: true,
        owner: {
          select: {
            userId: true, username: true, firstName: true, lastName: true,
            email: true, profileImage: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { storeId },
      orderBy: { productId: "desc" },
      include: {
        category: true,
        items: { orderBy: { price: "asc" } },
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        _count: { select: { reviews: true } },
      },
    }),
    // Fetched with the actor join so we can render "@username did X".
    // Wrapped in a try-catch so a malformed JSONB filter (Prisma is
    // picky about path queries when meta is empty) doesn't crash the
    // whole page — we just degrade to an empty activity list.
    fetchAudits(storeId),
  ]);

  if (!store) return notFound();

  // Lifetime revenue across all paid + fulfilled orders that touched a
  // product on this store. Computed inline because the matview only
  // covers the last 30 days.
  const revenueRow = await prisma.$queryRaw<Array<{ revenue: string }>>`
    SELECT COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue
      FROM "order_item" oi
      JOIN "product_item" pi ON pi.product_item_id = oi.product_item_id
      JOIN "product"      p  ON p.product_id      = pi.product_id
      JOIN "orders"       o  ON o.order_id        = oi.order_id
     WHERE p.store_id = ${storeId}
       AND o.status IN ('paid', 'fulfilled')
  `;
  const lifetimeRevenue = Number(revenueRow[0]?.revenue ?? 0);

  return (
    <>
      <Link
        href="/admin/stores"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All stores
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-metu-yellow overflow-hidden">
            {store.profileImage && (
              <Image
                src={store.profileImage}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
                unoptimized={isDataUrl(store.profileImage)}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl font-extrabold text-white truncate">
                {store.name}
              </h1>
              <Badge variant="mist">{store.businessType.name}</Badge>
              {store.suspendedAt && (
                <Badge variant="coral" className="uppercase text-[10px]">Suspended</Badge>
              )}
            </div>
            <p className="text-sm text-ink-secondary line-clamp-1 mt-1">{store.description}</p>
            <div className="text-xs text-ink-dim mt-1.5 inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              <span>
                Owner: {store.owner.firstName} {store.owner.lastName} (@{store.owner.username})
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <GlassButton tone="glass" href={`/store/${store.storeId}`}>
            View public page
          </GlassButton>
          <GlassButton tone="gold" href={`/admin/stores/${store.storeId}/edit`}>
            <Edit3 className="h-4 w-4" />
            Edit store
          </GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard variant="highlight" icon={Package} label="Products" value={products.length} />
        <StatCard
          icon={Star}
          label="Rating"
          value={store.rating > 0 ? `${(store.rating / 10).toFixed(1)}★` : "—"}
          variant={store.rating === 0 ? "zero" : "default"}
        />
        <StatCard
          icon={Banknote}
          label="Lifetime revenue"
          value={lifetimeRevenue > 0 ? coinsCompact(thbToCoins(lifetimeRevenue)) : "—"}
          valueTooltip={lifetimeRevenue > 0 ? coins(thbToCoins(lifetimeRevenue)) : undefined}
        />
        <StatCard icon={Calendar} label="Created" value={fmtDate(store.createdAt)} />
      </div>

      {/* Products */}
      <section className="mb-10">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold text-white inline-flex items-center gap-2">
            <Package className="h-5 w-5 text-metu-yellow" />
            Products ({products.length})
          </h2>
        </header>

        {products.length === 0 ? (
          <EmptyState
            variant="default"
            title="No products yet"
            description="The seller hasn't listed any products on this store."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-space-950 text-xs uppercase tracking-wider text-ink-dim">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-left px-4 py-2 font-medium">Category</th>
                  <th className="text-right px-4 py-2 font-medium">Variants</th>
                  <th className="text-right px-4 py-2 font-medium">Price</th>
                  <th className="text-right px-4 py-2 font-medium">Reviews</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const cover = p.images[0]?.productImage ?? null;
                  const minPrice = p.items.length > 0 ? Math.min(...p.items.map((it) => Number(it.price))) : 0;
                  const maxPrice = p.items.length > 0 ? Math.max(...p.items.map((it) => Number(it.price))) : 0;
                  return (
                    <tr key={p.productId} className="border-t border-line hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 rounded-lg bg-space-950 overflow-hidden">
                            {cover && (
                              <Image
                                src={cover}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized={isDataUrl(cover)}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">{p.name}</div>
                            <div className="text-xs text-ink-dim font-mono">#{p.productId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="mist">{p.category.categoryName}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">
                        {p.items.length}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-white">
                        {minPrice === 0 ? "—" :
                          minPrice === maxPrice
                            ? coins(thbToCoins(minPrice))
                            : `${coins(thbToCoins(minPrice))} – ${coins(thbToCoins(maxPrice))}`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">
                        {p._count.reviews}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="mist">Paused</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/stores/${storeId}/products/${p.productId}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-metu-yellow hover:underline"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section>
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold text-white">
            Recent activity ({audits.length})
          </h2>
        </header>
        {audits.length === 0 ? (
          <p className="text-sm text-ink-dim italic">No audit entries yet for this store.</p>
        ) : (
          <ul className="rounded-2xl border border-line divide-y divide-line/50 overflow-hidden">
            {audits.map((a) => (
              <li key={a.logId} className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className={a.action.startsWith("admin.") ? "font-mono text-metu-yellow" : "font-mono text-ink-secondary"}>
                      {a.action}
                    </span>
                    <span className="text-ink-dim mx-2">·</span>
                    <span className="text-ink-secondary">
                      {a.actor ? `${a.actor.firstName} ${a.actor.lastName} (@${a.actor.username})` : "system"}
                    </span>
                  </div>
                  <div className="text-xs text-ink-dim font-mono mt-0.5">
                    target: {a.targetType} #{a.targetId}
                  </div>
                </div>
                <span className="text-xs text-ink-dim font-mono shrink-0">
                  {fmtDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
