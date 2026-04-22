import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { BulkEditForm } from "./BulkEditForm";

export const dynamic = "force-dynamic";

export default async function BulkEditPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/products/bulk");
  if (!me.user?.store) redirect("/become-seller");

  // All product items the seller owns, with the parent product's name
  // for display. We work at the variant (ProductItem) level because
  // pricing lives there, not on Product.
  const items = await prisma.productItem.findMany({
    where: { product: { storeId: me.user.store.storeId } },
    orderBy: [{ product: { name: "asc" } }, { productItemId: "asc" }],
    select: {
      productItemId: true,
      deliveryMethod: true,
      price: true,
      quantity: true,
      discountPercent: true,
      product: { select: { productId: true, name: true, isActive: true } },
    },
  });

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
        title="Bulk edit prices"
        subtitle="Apply a percentage change across multiple variants in one shot."
      />
      <BulkEditForm
        items={items.map((it) => ({
          productItemId: it.productItemId,
          productId: it.product.productId,
          productName: it.product.name,
          isActive: it.product.isActive,
          deliveryMethod: it.deliveryMethod,
          quantity: it.quantity,
          discountPercent: it.discountPercent,
          price: Number(it.price),
        }))}
      />
    </>
  );
}
