import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { getCategories, getTags } from "@/lib/server/queries";
import { NewProductForm } from "@/app/seller/products/new/NewProductForm";

export const dynamic = "force-dynamic";

// Admin-side product creation under a specific store. Reuses the same
// NewProductForm component the seller flow uses — only the POST target
// and redirect change so the server writes an `admin.product.create`
// audit row instead of `product.create`. The role gate runs in
// apps/web/middleware.ts; this page just confirms the active session
// is an admin so a stale link doesn't surface the form to a buyer.
export default async function AdminNewProductPage({
  params,
}: {
  params: { storeId: string };
}) {
  const storeId = Number(params.storeId);
  if (!Number.isFinite(storeId)) return notFound();

  const me = await getMe();
  if (!me) redirect(`/login?next=/admin/stores/${storeId}/products/new`);
  if (me.role !== "admin") redirect(`/admin/stores/${storeId}`);

  const [store, categories, tags] = await Promise.all([
    prisma.store.findUnique({
      where: { storeId },
      select: { storeId: true, name: true, suspendedAt: true },
    }),
    getCategories(),
    getTags(),
  ]);
  if (!store) return notFound();

  return (
    <>
      <Link
        href={`/admin/stores/${storeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {store.name}
      </Link>
      <PageHeader
        title="New product"
        subtitle={`Adding under ${store.name} — admin override (writes admin.product.create audit row).`}
      />
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
        {store.suspendedAt && (
          <Badge variant="coral" className="uppercase text-[10px]">Store suspended</Badge>
        )}
        <Badge variant="yellow" className="uppercase text-[10px]">Admin override</Badge>
      </div>
      <NewProductForm
        categories={categories}
        tags={tags}
        submitUrl={`/api/admin/stores/${storeId}/products`}
        redirectAfter={`/admin/stores/${storeId}`}
        cancelHref={`/admin/stores/${storeId}`}
      />
    </>
  );
}
