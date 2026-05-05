import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { UserRowActions } from "@/components/admin/UserRowActions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { apiAuth, getMe } from "@/lib/session";
import { fmtDate } from "@/lib/format";

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
  // moderation metadata. NULL for active users; bannedAt is populated
  // only for admin-driven bans (which we now keep around so the user
  // can be unbanned). Self-deletes hard-delete the row entirely.
  bannedAt?: string | null;
  bannedReason?: string | null;
};

type UsersResp = {
  items: UserRow[];
  total: number;
  page: number;
  totalPages: number;
};

export const dynamic = "force-dynamic";

/**
 * / Step 3b — role tones use the admin-vocab mapping called out
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
  searchParams: {
    q?: string;
    role?: string;
    status?: string;
    page?: string;
    gender?: string;
    countryId?: string;
    buyerLevel?: string;
    sellerLevel?: string;
    signupAfter?: string;
    signupBefore?: string;
  };
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (v) qs.set(k, v);
  const [data, me] = await Promise.all([
    apiAuth<UsersResp>(`/admin/users?${qs.toString()}`).then(
      (d) => d ?? { items: [], total: 0, page: 1, totalPages: 1 },
    ),
    getMe(),
  ]);
  const myUserId = me?.user?.userId as number | undefined;
  // `?status=banned` filter shows only banned rows so the
  // operator can scan recent bans + tap "Unban" without sifting.
  const showingBanned = searchParams.status === "banned";

  // Server-friendly pagination — mirrors the buildHref pattern used on
  // /admin/audit so navigation works without JS.
  const buildHref = (next: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "page") p.set(k, v);
    p.set("page", String(next));
    return `/admin/users?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Users" subtitle={`${data.total} total users on the marketplace`} />

      <form action="/admin/users" method="get" className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search by username, email, name…"
          className="md:col-span-2 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <select
          name="role"
          defaultValue={searchParams.role ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">All roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
        </select>
        <select
          name="gender"
          defaultValue={searchParams.gender ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Any gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
        <select
          name="buyerLevel"
          defaultValue={searchParams.buyerLevel ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Any buyer level</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Buyer Lv.{n}</option>)}
        </select>
        <select
          name="sellerLevel"
          defaultValue={searchParams.sellerLevel ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Any seller level</option>
          {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Seller Lv.{n}</option>)}
        </select>
        <input
          type="date"
          name="signupAfter"
          defaultValue={searchParams.signupAfter ?? ""}
          placeholder="Signed up after"
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-xs text-white"
        />
        <input
          type="date"
          name="signupBefore"
          defaultValue={searchParams.signupBefore ?? ""}
          placeholder="Signed up before"
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-xs text-white"
        />
        <button className="rounded-full bg-metu-yellow text-space-black px-4 py-2 text-sm font-bold col-span-2 md:col-span-1">
          Apply filters
        </button>
      </form>

      {/* Phase 48 — status chips. Toggle "Banned" to surface only the
          banned rows + their Unban action; clear it to return to the
          default listing (which already excludes anonymised users). */}
      <div className="mb-4 flex gap-2 text-xs">
        <Link
          href={(() => {
            const p = new URLSearchParams();
            if (searchParams.q) p.set("q", searchParams.q);
            if (searchParams.role) p.set("role", searchParams.role);
            return `/admin/users${p.toString() ? "?" + p.toString() : ""}`;
          })()}
          className={`rounded-full px-3 py-1.5 font-semibold transition ${
            !showingBanned
              ? "bg-metu-yellow text-space-black"
              : "bg-white/5 text-ink-dim hover:text-white"
          }`}
        >
          Active
        </Link>
        <Link
          href={(() => {
            const p = new URLSearchParams();
            if (searchParams.q) p.set("q", searchParams.q);
            if (searchParams.role) p.set("role", searchParams.role);
            p.set("status", "banned");
            return `/admin/users?${p.toString()}`;
          })()}
          className={`rounded-full px-3 py-1.5 font-semibold transition inline-flex items-center gap-1.5 ${
            showingBanned
              ? "bg-coral/20 text-coral ring-1 ring-coral/40"
              : "bg-white/5 text-ink-dim hover:text-white"
          }`}
        >
          Banned only
        </Link>
      </div>

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
                  {/* Phase 11 / F15 — Avatar primitive renders initials
                      over a deterministic colour when profileImage is
                      missing, instead of leaving a flat yellow disc. */}
                  <Avatar
                    name={`${u.firstName} ${u.lastName}`}
                    email={u.username}
                    src={u.profileImage}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {u.firstName} {u.lastName}
                      </span>
                      {/* Banned rows stick around in the user table so
                          the operator can lift the ban; reason surfaces
                          on hover via title. Self-deletes hard-delete
                          the row, so a deleted user simply isn't in the
                          listing. */}
                      {u.bannedAt && (
                        <Badge variant="coral" className="uppercase text-[10px]" title={u.bannedReason ?? "Banned by admin"}>
                          Banned
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-ink-dim">@{u.username}</div>
                    {u.bannedReason && (
                      <div className="text-[11px] text-coral mt-0.5 max-w-[260px] truncate" title={u.bannedReason}>
                        {u.bannedReason}
                      </div>
                    )}
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
                  {fmtDate(u.createdDate)}
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
            requirePasswordReset={Boolean((u as any).requirePasswordReset)}
            isBanned={Boolean(u.bannedAt)}
          />
        )}
      />
    </>
  );
}
