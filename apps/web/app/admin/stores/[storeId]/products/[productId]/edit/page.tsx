import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getCategories, getTags } from "@/lib/server/queries";
import { prisma } from "@/lib/server/prisma";
import { EditProductForm } from "@/app/seller/products/[id]/edit/EditProductForm";

export const dynamic = "force-dynamic";

// Admin product edit page. Reuses EditProductForm with mode="admin" +
// storeId so the form routes through /api/admin/stores/:storeId/
// products/:productId/ and returns to the admin store detail page on
// save. Validates the URL pair (storeId / productId) by ensuring the
// product belongs to the given store — a wrong combo 404s.

export default async function AdminProductEditPage({
  params,
}: {
  params: { storeId: string; productId: string };
}) {
  const storeId = Number(params.storeId);
  const productId = Number(params.productId);
  if (!Number.isFinite(storeId) || !Number.isFinite(productId)) return notFound();

  const product = await prisma.product.findFirst({
    where: { productId },
    include: {
      items: { orderBy: { productItemId: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
      details: { orderBy: { productDetailId: "asc" } },
      store: { select: { storeId: true, name: true } },
    },
  });
  if (!product) return notFound();
  if (product.storeId !== storeId) return notFound();

  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <>
      <Link
        href={`/admin/stores/${storeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {product.store.name}
      </Link>
      <PageHeader
        title={`Edit product: ${product.name}`}
        subtitle="Admin override — variant + image changes save instantly. Audit row tagged `admin.product.update`."
      />
      <EditProductForm
        productId={product.productId}
        storeId={storeId}
        mode="admin"
        initial={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          images: product.images.map((i) => i.productImage),
          tagIds: product.productNTags.map((nt) => nt.tagId),
          isStackable: product.isStackable,
          items: product.items.map((it) => ({
            name: it.name,
            description: it.description ?? undefined,
            image: it.image ?? undefined,
            deliveryMethod: it.deliveryMethod as "download" | "email" | "license_key" | "streaming",
            quantity: it.quantity ?? undefined,
            price: Number(it.price),
            discountPercent: it.discountPercent,
            discountAmount: Number(it.discountAmount),
            deliveryUrl: it.deliveryUrl ?? "",
            licenseKeyTemplate: it.licenseKeyTemplate ?? "",
          })),
          details: (product.details ?? []).map((d) => ({
            detailName: d.detailName,
            detailValue: d.detailValue,
          })),
        }}
        categories={categories}
        tags={tags}
      />
    </>
  );
}
