"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Ticket, ShoppingBag, Store, BarChart3, Wallet, CreditCard } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/seller",            label: "Overview",      icon: LayoutDashboard },
  { href: "/seller/analytics",  label: "Analytics",     icon: BarChart3 },
  { href: "/seller/products",   label: "Products",      icon: Package },
  { href: "/seller/coupons",    label: "Coupons",       icon: Ticket },
  { href: "/seller/orders",     label: "Orders",        icon: ShoppingBag },
  { href: "/seller/wallet",     label: "Wallet",        icon: Wallet },
  { href: "/seller/onboarding", label: "Stripe Connect", icon: CreditCard },
];

export function SellerSidebar({ storeName }: { storeName?: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar (unchanged at md+). Hidden on phone where it
          would eat 86% of a 375px viewport. */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-space-900 border-r border-line min-h-screen px-5 py-6 sticky top-0">
        <Logo />
        <div className="mt-8 rounded-xl border border-metu-yellow/30 bg-metu-yellow/10 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-metu-yellow">Seller area</div>
          <div className="font-display font-bold text-sm text-white flex items-center gap-1.5 mt-0.5">
            <Store className="h-3.5 w-3.5" />
            {storeName ?? "Your store"}
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {ITEMS.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-metu-yellow text-space-black"
                    : "text-ink-secondary hover:bg-white/5 hover:text-white",
                )}
              >
                <it.icon className="h-4 w-4" />
                <span className="flex-1">{it.label}</span>
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

      {/* Mobile / tablet: horizontal strip nav at the top. Sticky so
          the seller can switch sections without scrolling back up.
          Active route gets the gold pill — same affordance as desktop. */}
      <div className="md:hidden sticky top-0 z-30 bg-space-900 border-b border-line">
        <div className="flex items-center justify-between px-4 py-2.5 gap-3">
          <Logo size="sm" />
          <div className="flex items-center gap-2 text-[11px] font-semibold whitespace-nowrap">
            <span className="inline-flex items-center gap-1 text-metu-yellow">
              <Store className="h-3 w-3" />
              {storeName ?? "Your store"}
            </span>
            <Link href="/" className="text-ink-dim hover:text-metu-yellow">
              ← Marketplace
            </Link>
          </div>
        </div>
        <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto px-3 pb-2">
          {ITEMS.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "bg-metu-yellow text-space-black"
                    : "text-ink-secondary hover:bg-white/5 hover:text-white",
                )}
              >
                <it.icon className="h-3.5 w-3.5" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
