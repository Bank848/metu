import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { getMe } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin");
  if (me.role !== "admin") redirect("/");
  return (
    <div className="flex min-h-screen bg-space-black">
      <AdminSidebar />
      <main id="main" className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
