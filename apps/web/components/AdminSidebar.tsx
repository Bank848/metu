"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Store, FileBarChart, ShieldCheck, History, Sparkles, Settings, Network, Layers, RotateCcw } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin",              label: "Overview",   icon: LayoutDashboard },
  { href: "/admin/users",        label: "Users",      icon: Users },
  { href: "/admin/stores",       label: "Stores",     icon: Store },
  { href: "/admin/reports",      label: "Reports",    icon: FileBarChart },
  { href: "/admin/audit",        label: "Audit log",  icon: History },
  // Phase 27 — Stripe refund queue (only Stripe-charged orders).
  { href: "/admin/refunds",      label: "Refunds",    icon: RotateCcw },
  // Phase 17.1 / 26 — runtime feature flags (slimmed to favoritesEnabled
  // + platformFeePercent after the wallet/PromptPay layer was removed).
  { href: "/admin/settings",     label: "Settings",   icon: Settings },
  // Phase 21 — split the dead /admin/architecture link into two
  // dedicated pages: ER diagram (in-house live render) + tech stack.
  { href: "/admin/er-diagram",   label: "ER Diagram", icon: Network },
  { href: "/admin/tech-stack",   label: "Tech Stack", icon: Layers },
  { href: "/admin/changelog",    label: "What's new", icon: Sparkles },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 bg-space-950 border-r border-line min-h-screen px-5 py-6 sticky top-0">
      <Logo />
      <div className="mt-8 rounded-xl border border-metu-yellow/30 bg-metu-yellow/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-metu-yellow flex items-center gap-1">
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
                active ? "bg-metu-yellow text-space-black" : "text-ink-secondary hover:bg-white/5 hover:text-white",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8">
        <Link href="/" className="text-xs font-semibold text-ink-dim hover:text-metu-yellow">
          ← Back to marketplace
        </Link>
      </div>
    </aside>
  );
}
