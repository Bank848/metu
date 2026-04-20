import Link from "next/link";
import {
  Star,
  ShoppingBag,
  Store,
  LayoutGrid,
  Tag,
  Box,
  Gamepad2,
  Wrench,
  GraduationCap,
  Palette,
  Plug,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { Logo } from "./Logo";
import { SearchPill } from "./SearchPill";
import { AuthMenu } from "./AuthMenu";
import { getMe } from "@/lib/session";

type Tab = { label: string; icon: any; href: string };

const TABS: Tab[] = [
  { label: "All",          icon: LayoutGrid,       href: "/browse" },
  { label: "-50% Discount",icon: Tag,              href: "/browse?sort=price_asc" },
  { label: "3D Mode",      icon: Box,              href: "/browse?category=11" },   // 3D Models
  { label: "Gaming",       icon: Gamepad2,         href: "/browse?category=17" },   // Game Assets
  { label: "Services",     icon: Wrench,           href: "/browse?category=19" },   // Plug-ins
  { label: "Courses",      icon: GraduationCap,    href: "/browse?category=12" },
  { label: "Artworks",     icon: Palette,          href: "/browse?category=20" },   // Illustrations
  { label: "Plug-in",      icon: Plug,             href: "/browse?category=19" },
  { label: "Others",       icon: MoreHorizontal,   href: "/browse" },
];

export async function TopNav({ q }: { q?: string } = {}) {
  const me = await getMe();
  const hasStore = Boolean(me?.user?.store);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-space-black/85 backdrop-blur supports-[backdrop-filter]:bg-space-black/70">
      {/* Row 1 */}
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-6">
        <Logo size="md" />

        <SearchPill defaultValue={q ?? ""} />

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/browse?sort=rating"
            aria-label="Favourites"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-brand-yellow hover:bg-white/5 transition"
          >
            <Star className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-brand-yellow hover:bg-white/5 transition"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
          <AddStoreButton loggedIn={Boolean(me)} hasStore={hasStore} />
        </div>

        <AuthMenu
          user={me?.user ?? null}
          role={(me?.role as any) ?? null}
          hasStore={hasStore}
        />

        <LocaleSwitcher />
      </div>

      {/* Row 2 — tabs */}
      <nav className="mx-auto max-w-[1440px] px-4 md:px-6">
        <div className="no-scrollbar flex items-center gap-6 overflow-x-auto py-2.5 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-secondary hover:text-brand-yellow transition"
            >
              <t.icon className="h-4 w-4 text-brand-yellow/80" strokeWidth={2.25} />
              <span className="font-medium">{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function AddStoreButton({ loggedIn, hasStore }: { loggedIn: boolean; hasStore: boolean }) {
  const href = !loggedIn
    ? "/login?next=/become-seller"
    : hasStore
    ? "/seller"
    : "/become-seller";
  const label = hasStore ? "Dashboard" : "+ Add Store";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-space-black hover:bg-brand-yellowDark transition shadow-pop"
    >
      <Store className="h-4 w-4" />
      {label}
    </Link>
  );
}

function LocaleSwitcher() {
  return (
    <button
      type="button"
      className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition"
      aria-label="Language"
    >
      <span aria-hidden>🇹🇭</span>
      <span>EN</span>
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}
