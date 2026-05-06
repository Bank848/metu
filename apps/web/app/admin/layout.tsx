import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { getMe, requireResetGuard } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin");
  if (me.role !== "admin") redirect("/");
  // admins aren't immune to force-reset (they can be
  // flagged by another admin). Bounce to /profile/edit before
  // letting them act on the dashboard.
  requireResetGuard(me, "/admin");
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-space-black">
      <AdminSidebar />
      <main id="main" className="flex-1 min-w-0 px-4 sm:px-6 md:px-8 py-6 md:py-10">{children}</main>
    </div>
  );
}
