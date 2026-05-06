import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/server/prisma";
import { EditStoreForm } from "@/app/seller/store/edit/EditStoreForm";

export const dynamic = "force-dynamic";

// Admin store edit page. Reuses the seller-side EditStoreForm with
// `mode="admin"` so the form posts to /api/admin/stores/:id and the
// post-save CTA returns to the admin detail page rather than the
// public storefront.

export default async function AdminStoreEditPage({
  params,
}: {
  params: { storeId: string };
}) {
  const storeId = Number(params.storeId);
  if (!Number.isFinite(storeId)) return notFound();

  const [store, businessTypes] = await Promise.all([
    prisma.store.findUnique({
      where: { storeId },
      include: { businessType: true },
    }),
    prisma.businessType.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!store) return notFound();

  return (
    <>
      <Link
        href={`/admin/stores/${storeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to store detail
      </Link>
      <PageHeader
        title={`Edit store: ${store.name}`}
        subtitle="Admin override — your changes are logged with action `admin.store.update`."
      />
      <EditStoreForm
        store={{
          storeId: store.storeId,
          name: store.name,
          description: store.description,
          businessTypeId: store.businessTypeId,
          profileImage: store.profileImage ?? "",
          coverImage: store.coverImage ?? "",
        }}
        businessTypes={businessTypes}
        mode="admin"
      />
    </>
  );
}
