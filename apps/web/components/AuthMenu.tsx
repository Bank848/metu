"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  User as UserIcon,
  Package,
  Store as StoreIcon,
  ShieldCheck,
  LogOut,
  LogIn,
  ChevronDown,
  Star,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

type AuthMenuUser = {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImage?: string | null;
  store?: { storeId: number; name: string } | null;
} | null;

export function AuthMenu({
  user,
  role,
  hasStore,
}: {
  user: AuthMenuUser;
  role: "buyer" | "seller" | "admin" | null;
  hasStore: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await fetch(`/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  // ───── Logged out ─────
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden md:inline">Log in</span>
      </Link>
    );
  }

  // ───── Logged in ─────
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-line p-0.5 hover:border-brand-yellow/60 transition",
          open && "border-brand-yellow/60",
        )}
      >
        {/* Phase 11 / F15 — fall back to initials over a deterministic
            colour instead of a flat coloured circle when the user has
            no profile image. The `<Avatar>` primitive handles both the
            uploaded-photo and the fallback path. */}
        <Avatar
          name={`${user.firstName} ${user.lastName}`}
          email={user.username}
          src={user.profileImage}
          size="sm"
          className="h-8 w-8"
        />
        <ChevronDown className="h-3.5 w-3.5 text-ink-dim mr-1.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-space-900 shadow-card py-1 animate-fade-in-up"
        >
          <div className="px-4 py-3 border-b border-line">
            <div className="text-sm font-semibold text-white">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-ink-dim">@{user.username}</div>
            {/* Phase 11 / F6 — when the user is BOTH a buyer (per
                stats.role) AND owns a store, render two badges side by
                side instead of forcing a single role pill. The previous
                copy showed only `role` which read as wrong on the
                seeded buyer demo (Thana Siri owns store id 19 but
                stats.role = "buyer"). Schema is unchanged — we're just
                surfacing the dual-role data more accurately. Admin
                trumps everything (admins always render the admin pill
                alone). Match Phase 10 admin-tables convention:
                buyer = mist (neutral), seller = success (mint). */}
            <RoleBadges role={role} hasStore={hasStore} />
          </div>

          <MenuItem href="/profile" icon={UserIcon} onClose={() => setOpen(false)}>
            Profile
          </MenuItem>
          <MenuItem href="/orders" icon={Package} onClose={() => setOpen(false)}>
            My orders
          </MenuItem>
          <MenuItem href="/messages" icon={Mail} onClose={() => setOpen(false)}>
            {t("nav.messages")}
          </MenuItem>
          <MenuItem href="/my-reviews" icon={Star} onClose={() => setOpen(false)}>
            My reviews
          </MenuItem>
          {(role === "seller" || hasStore) && (
            <MenuItem href="/seller" icon={StoreIcon} onClose={() => setOpen(false)}>
              Seller dashboard
            </MenuItem>
          )}
          {role === "admin" && (
            <MenuItem href="/admin" icon={ShieldCheck} onClose={() => setOpen(false)}>
              Admin panel
            </MenuItem>
          )}

          <div className="border-t border-line my-1" />

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-300 hover:bg-white/5 hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  children,
  onClose,
}: {
  href: string;
  icon: any;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-secondary hover:bg-white/5 hover:text-white"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

/**
 * Phase 11 / F6 — exported so /profile can render the same row of
 * badges in its header card. See `<AuthMenu>` for the rationale.
 *
 * Badge map (matches /admin/users):
 *   admin  → yellow  (privileged)
 *   seller → success (mint — "live" relationship)
 *   buyer  → mist    (neutral)
 *
 * `hasStore` is enough to claim the seller badge even when stats.role
 * still says "buyer" — that's the whole point of the dual-role fix.
 */
export function RoleBadges({
  role,
  hasStore,
}: {
  role: "buyer" | "seller" | "admin" | null;
  hasStore: boolean;
}) {
  if (!role) return null;
  if (role === "admin") {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant="yellow" className="uppercase text-[10px] tracking-wider">Admin</Badge>
      </div>
    );
  }
  // Buyer chip is always present once the user is logged in and not an
  // admin. Seller chip joins it whenever the user owns a store, even if
  // stats.role is still set to "buyer" on the legacy seed.
  const showSeller = role === "seller" || hasStore;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      <Badge variant="mist" className="uppercase text-[10px] tracking-wider">Buyer</Badge>
      {showSeller && (
        <Badge variant="success" className="uppercase text-[10px] tracking-wider">Seller</Badge>
      )}
    </div>
  );
}
