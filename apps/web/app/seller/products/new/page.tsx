import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getCategories, getTags } from "@/lib/server/queries";
import { NewProductForm } from "./NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/products/new");
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

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
        title="New product"
        subtitle="Add a digital product with one or more variants (downloads, license keys, etc)."
      />
      <NewProductForm categories={categories} tags={tags} />
    </>
  );
}
