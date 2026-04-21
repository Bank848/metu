import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getCategories, getTags } from "@/lib/server/queries";
import { prisma } from "@/lib/server/prisma";
import { EditProductForm } from "./EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me) redirect(`/login?next=/seller/products/${params.id}/edit`);
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return notFound();

  // Direct Prisma read + ownership check — same pattern as the admin routes.
  const product = await prisma.product.findUnique({
    where: { productId },
    include: {
      items: { orderBy: { productItemId: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      productNTags: { include: { tag: true } },
    },
  });
  if (!product) return notFound();
  if (me.role !== "admin" && product.storeId !== me.user?.store?.storeId) return notFound();

  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <>
      <Link
        href="/seller/products"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to products
      </Link>
      <PageHeader
        title="Edit product"
        subtitle={`Editing "${product.name}" · variant & image changes save instantly.`}
      />
      <EditProductForm
        productId={product.productId}
        initial={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          images: product.images.map((i) => i.productImage),
          tagIds: product.productNTags.map((nt) => nt.tagId),
          items: product.items.map((it) => ({
            deliveryMethod: it.deliveryMethod as "download" | "email" | "license_key" | "streaming",
            quantity: it.quantity,
            price: Number(it.price),
            discountPercent: it.discountPercent,
            discountAmount: Number(it.discountAmount),
          })),
        }}
        categories={categories}
        tags={tags}
      />
    </>
  );
}
