import { redirect } from "next/navigation";
import { SellerSidebar } from "@/components/SellerSidebar";
import { getMe } from "@/lib/session";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller");
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

  return (
    <div className="flex min-h-screen bg-space-black">
      <SellerSidebar storeName={me.user?.store?.name} />
      <main id="main" className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
