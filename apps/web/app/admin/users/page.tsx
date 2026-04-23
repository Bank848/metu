import Image from "next/image";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { UserRowActions } from "@/components/admin/UserRowActions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { apiAuth, getMe } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";

type UserRow = {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  createdDate: string;
  country?: { name: string } | null;
  stats?: { role: "buyer" | "seller" | "admin" } | null;
  store?: { name: string } | null;
};

type UsersResp = {
  items: UserRow[];
  total: number;
  page: number;
  totalPages: number;
};

export const dynamic = "force-dynamic";

/**
 * Phase 10 / Step 3b — role tones use the admin-vocab mapping called out
 * in the playbook: admin = yellow (privileged), seller = mint
 * (positive / "live" relationship), buyer = mist (neutral). All three
 * variants are pre-existing on `<Badge>` — no new tokens introduced.
 */
const roleVariant = { admin: "yellow", seller: "success", buyer: "mist" } as const;

const columns: DataTableColumn<UserRow>[] = [
  { key: "user",    header: "User" },
  { key: "email",   header: "Email" },
  { key: "country", header: "Country" },
  { key: "role",    header: "Role" },
  { key: "store",   header: "Store" },
  { key: "joined",  header: "Joined" },
];

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; page?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams.q) qs.set("q", searchParams.q);
  if (searchParams.role) qs.set("role", searchParams.role);
  if (searchParams.page) qs.set("page", searchParams.page);
  const [data, me] = await Promise.all([
    apiAuth<UsersResp>(`/admin/users?${qs.toString()}`).then(
      (d) => d ?? { items: [], total: 0, page: 1, totalPages: 1 },
    ),
    getMe(),
  ]);
  const myUserId = me?.user?.userId as number | undefined;

  // Server-friendly pagination — mirrors the buildHref pattern used on
  // /admin/audit so navigation works without JS.
  const buildHref = (next: number) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set("q", searchParams.q);
    if (searchParams.role) p.set("role", searchParams.role);
    p.set("page", String(next));
    return `/admin/users?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Users" subtitle={`${data.total} total users on the marketplace`} />

      <form action="/admin/users" method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search by username, email, name…"
          className="flex-1 rounded-full border border-line bg-space-800 px-4 py-2.5 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <select
          name="role"
          defaultValue={searchParams.role ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2.5 text-sm text-white"
        >
          <option value="">All roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
        </select>
        <button className="rounded-full bg-metu-yellow text-space-black px-4 py-2.5 text-sm font-bold">
          Filter
        </button>
      </form>

      <DataTable<UserRow>
        ariaLabel="Users"
        columns={columns}
        rows={data.items}
        getRowKey={(u) => u.userId}
        emptyState={
          <EmptyState
            variant="noResults"
            title="No users match those filters"
            description="Try clearing the search or role filter."
          />
        }
        pagination={{
          page: data.page,
          totalPages: data.totalPages,
          buildHref,
        }}
        renderCell={(u, col) => {
          switch (col.key) {
            case "user":
              return (
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 rounded-full bg-metu-yellow overflow-hidden shrink-0">
                    {u.profileImage && (
                      <Image
                        src={u.profileImage}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                        unoptimized={isDataUrl(u.profileImage)}
                      />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="text-xs text-ink-dim">@{u.username}</div>
                  </div>
                </div>
              );
            case "email":
              return <span className="text-sm text-ink-secondary">{u.email}</span>;
            case "country":
              return (
                <span className="text-sm text-ink-secondary">{u.country?.name ?? "—"}</span>
              );
            case "role":
              return (
                <Badge variant={roleVariant[u.stats?.role ?? "buyer"]} className="uppercase">
                  {u.stats?.role ?? "buyer"}
                </Badge>
              );
            case "store":
              return <span className="text-sm text-ink-secondary">{u.store?.name ?? "—"}</span>;
            case "joined":
              return (
                <span className="text-xs text-ink-dim">
                  {new Date(u.createdDate).toLocaleDateString()}
                </span>
              );
            default:
              return null;
          }
        }}
        actions={(u) => (
          <UserRowActions
            userId={u.userId}
            currentRole={u.stats?.role ?? "buyer"}
            username={u.username}
            isSelf={u.userId === myUserId}
          />
        )}
      />
    </>
  );
}
