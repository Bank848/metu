import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { getMe, requireResetGuard } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin");
  if (me.role !== "admin") redirect("/");
  // Phase 15.5 — admins aren't immune to force-reset (they can be
  // flagged by another admin). Bounce to /profile/edit before
  // letting them act on the dashboard.
  requireResetGuard(me, "/admin");
  return (
    <div className="flex min-h-screen bg-space-black">
      <AdminSidebar />
      <main id="main" className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
