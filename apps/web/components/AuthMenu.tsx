"use client";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        <div className="relative h-8 w-8 rounded-full overflow-hidden bg-space-700">
          {user.profileImage ? (
            <Image
              src={user.profileImage}
              alt={`${user.firstName} ${user.lastName}`}
              fill
              sizes="32px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <UserIcon className="h-4 w-4 m-2 text-ink-dim" />
          )}
        </div>
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
            {role && (
              <div className="mt-1.5 inline-flex rounded-full bg-brand-yellow/15 text-brand-yellow text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                {role}
              </div>
            )}
          </div>

          <MenuItem href="/profile" icon={UserIcon} onClose={() => setOpen(false)}>
            Profile
          </MenuItem>
          <MenuItem href="/orders" icon={Package} onClose={() => setOpen(false)}>
            My orders
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
