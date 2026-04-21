import Image from "next/image";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { UserRowActions } from "@/components/admin/UserRowActions";
import { apiAuth, getMe } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";

type UsersResp = {
  items: Array<{
    userId: number;
    username: string; email: string;
    firstName: string; lastName: string;
    profileImage: string | null;
    createdDate: string;
    country?: { name: string } | null;
    stats?: { role: "buyer" | "seller" | "admin" } | null;
    store?: { name: string } | null;
  }>;
  total: number;
  page: number;
  totalPages: number;
};

export const dynamic = "force-dynamic";

const roleVariant = { admin: "dark", seller: "yellow", buyer: "mist" } as const;

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string; role?: string; page?: string } }) {
  const qs = new URLSearchParams();
  if (searchParams.q) qs.set("q", searchParams.q);
  if (searchParams.role) qs.set("role", searchParams.role);
  if (searchParams.page) qs.set("page", searchParams.page);
  const [data, me] = await Promise.all([
    apiAuth<UsersResp>(`/admin/users?${qs.toString()}`).then((d) => d ?? { items: [], total: 0, page: 1, totalPages: 1 }),
    getMe(),
  ]);
  const myUserId = me?.user?.userId as number | undefined;

  return (
    <>
      <PageHeader title="Users" subtitle={`${data.total} total users on the marketplace`} />

      <form action="/admin/users" method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search by username, email, name…"
          className="flex-1 rounded-full border border-line bg-space-800 px-4 py-2.5 text-sm text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none"
        />
        <select name="role" defaultValue={searchParams.role ?? ""} className="rounded-full border border-line bg-space-800 px-3 py-2.5 text-sm text-white">
          <option value="">All roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
        </select>
        <button className="rounded-full bg-brand-yellow text-space-black px-4 py-2.5 text-sm font-bold">Filter</button>
      </form>

      <div className="rounded-2xl border border-line bg-space-850 overflow-hidden">
        <table className="w-full">
          <thead className="bg-space-800 text-xs font-semibold uppercase tracking-wider text-ink-dim">
            <tr>
              <th className="text-left px-5 py-3">User</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Country</th>
              <th className="text-left px-5 py-3">Role</th>
              <th className="text-left px-5 py-3">Store</th>
              <th className="text-left px-5 py-3">Joined</th>
              <th className="text-right px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.items.map((u) => (
              <tr key={u.userId} className="hover:bg-white/5">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-9 w-9 rounded-full bg-brand-yellow overflow-hidden shrink-0">
                      {u.profileImage && <Image src={u.profileImage} alt="" fill sizes="36px" className="object-cover" unoptimized={isDataUrl(u.profileImage)} />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-ink-dim">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-ink-secondary">{u.email}</td>
                <td className="px-5 py-3 text-sm text-ink-secondary">{u.country?.name ?? "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant={roleVariant[u.stats?.role ?? "buyer"]} className="uppercase">
                    {u.stats?.role ?? "buyer"}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-sm text-ink-secondary">{u.store?.name ?? "—"}</td>
                <td className="px-5 py-3 text-xs text-ink-dim">{new Date(u.createdDate).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <UserRowActions
                    userId={u.userId}
                    currentRole={u.stats?.role ?? "buyer"}
                    username={u.username}
                    isSelf={u.userId === myUserId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
