import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getBusinessTypes, getStore } from "@/lib/server/queries";
import { EditStoreForm } from "./EditStoreForm";

export const dynamic = "force-dynamic";

export default async function EditStorePage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/store/edit");
  if (!me.user?.store) redirect("/become-seller");

  const [businessTypes, data] = await Promise.all([
    getBusinessTypes(),
    getStore(me.user.store.storeId),
  ]);
  if (!data) redirect("/seller");

  return (
    <>
      <Link
        href="/seller"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>
      <PageHeader
        title="Edit store"
        subtitle="Update your storefront's name, description, business type, and imagery."
      />
      <EditStoreForm
        store={{
          storeId: data.store.storeId,
          name: data.store.name,
          description: data.store.description,
          businessTypeId: data.store.businessTypeId,
          profileImage: data.store.profileImage ?? "",
          coverImage: data.store.coverImage ?? "",
        }}
        businessTypes={businessTypes}
      />
    </>
  );
}
