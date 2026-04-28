import { redirect } from "next/navigation";
import { SellerSidebar } from "@/components/SellerSidebar";
import { getMe, requireResetGuard } from "@/lib/session";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller");
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");
  // Phase 15.5 — sellers can't manage their store while a force-
  // reset is pending. Bounce to /profile/edit until cleared.
  requireResetGuard(me, "/seller");

  return (
    <div className="flex min-h-screen bg-space-black">
      <SellerSidebar storeName={me.user?.store?.name} />
      <main id="main" className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
