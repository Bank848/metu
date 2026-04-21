import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getBusinessTypes } from "@/lib/server/queries";
import { BecomeSellerForm } from "./BecomeSellerForm";

export const dynamic = "force-dynamic";

export default async function BecomeSellerPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/become-seller");
  if (me.user?.store) redirect("/seller");

  const businessTypes = await getBusinessTypes();

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-2xl px-6 md:px-8 py-10">
        <PageHeader
          title="Open your store on METU"
          subtitle="Tell buyers who you are and what kind of digital products you sell."
        />
        <BecomeSellerForm businessTypes={businessTypes} />
      </main>
      <Footer />
    </>
  );
}
