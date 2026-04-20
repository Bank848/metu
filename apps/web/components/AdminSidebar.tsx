"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Store, FileBarChart, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin",         label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users",   label: "Users",    icon: Users },
  { href: "/admin/stores",  label: "Stores",   icon: Store },
  { href: "/admin/reports", label: "Reports",  icon: FileBarChart },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 bg-space-950 border-r border-line min-h-screen px-5 py-6 sticky top-0">
      <Logo />
      <div className="mt-8 rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-yellow flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Admin area
        </div>
        <div className="font-display font-bold text-sm text-white mt-0.5">Marketplace control</div>
      </div>
      <nav className="mt-6 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-brand-yellow text-space-black" : "text-ink-secondary hover:bg-white/5 hover:text-white",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8">
        <Link href="/" className="text-xs font-semibold text-ink-dim hover:text-brand-yellow">
          ← Back to marketplace
        </Link>
      </div>
    </aside>
  );
}
