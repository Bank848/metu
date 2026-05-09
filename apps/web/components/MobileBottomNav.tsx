"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingBag, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartCount } from "@/lib/useCartCount";

// Mobile-only bottom tab bar (Home, Browse, Cart, Favorites, Account).
// Hidden on desktop where TopNav covers the same destinations.
// Cart count comes from the shared `useCartCount` hook so this badge
// and CartNavIcon share one polling loop.

interface Tab {
  href: string;
  label: string;
  icon: typeof Home;
  /** Match these prefixes for active highlighting. */
  match: (pathname: string) => boolean;
  /** When true, this tab carries the cart badge. */
  showCartBadge?: boolean;
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    href: "/browse",
    label: "Browse",
    icon: Search,
    match: (p) => p.startsWith("/browse") || p.startsWith("/product/"),
  },
  {
    href: "/cart",
    label: "Cart",
    icon: ShoppingBag,
    match: (p) => p.startsWith("/cart") || p.startsWith("/checkout"),
    showCartBadge: true,
  },
  {
    href: "/favorites",
    label: "Saved",
    icon: Heart,
    match: (p) => p.startsWith("/favorites"),
  },
  {
    href: "/profile",
    label: "Account",
    icon: User,
    // /admin is intentionally NOT matched: tapping "Account" leaves /admin.
    match: (p) =>
      p.startsWith("/profile") ||
      p.startsWith("/orders") ||
      p.startsWith("/seller"),
  },
];

export function MobileBottomNav({ favoritesEnabled = true }: { favoritesEnabled?: boolean }) {
  const pathname = usePathname();
  const cartCount = useCartCount();

  // Hide on auth pages, checkout, and admin to keep those flows clean.
  const HIDE_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-pending", "/verify-phone", "/feature-tour", "/admin"];
  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null;

  const visible = TABS.filter((t) => favoritesEnabled || t.label !== "Saved");

  return (
    <>
      {/* Spacer so the floating nav doesn't cover short-page content. */}
      <div aria-hidden className="md:hidden h-[62px]" />
      <nav
        aria-label="Primary"
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-40",
          // Backdrop blur so the nav reads as overlay, not a flat bar.
          "glass-morphism-strong border-t border-white/8",
          // Honour iOS safe area so the bar sits above the home indicator.
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <ul className="flex items-stretch justify-around">
          {visible.map((tab) => {
            const active = tab.match(pathname ?? "");
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition",
                    // Min tap target >= 44px (iOS HIG / Material).
                    "min-h-[56px]",
                    active
                      ? "text-metu-yellow"
                      : "text-ink-secondary hover:text-white active:text-white",
                  )}
                >
                  {/* Active pill above the icon. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-metu-yellow"
                    />
                  )}
                  <span className="relative">
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    {tab.showCartBadge && cartCount > 0 && (
                      <span
                        aria-label={`${cartCount} item${cartCount === 1 ? "" : "s"} in cart`}
                        className="absolute -top-1.5 -right-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-metu-yellow px-1 text-[9px] font-bold text-space-black ring-2 ring-space-black"
                      >
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </span>
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
