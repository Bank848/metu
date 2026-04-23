import Link from "next/link";
import {
  Star,
  Heart,
  ShoppingBag,
  Store,
  ShieldCheck,
  LayoutGrid,
  Tag,
  Box,
  Gamepad2,
  Wrench,
  GraduationCap,
  Palette,
  Plug,
  MoreHorizontal,
} from "lucide-react";
import { Logo } from "./Logo";
import { SearchPill } from "./SearchPill";
import { AuthMenu } from "./AuthMenu";
import { SoundToggle } from "./SoundToggle";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { getMe } from "@/lib/session";
import { getServerT } from "@/lib/i18n/server";

type Tab = { label: string; icon: any; href: string };

const TABS: Tab[] = [
  { label: "All",            icon: LayoutGrid,     href: "/browse" },
  { label: "-50% Discount",  icon: Tag,            href: "/browse?sort=price_asc" },
  { label: "3D Mode",        icon: Box,            href: "/browse?category=11" },
  { label: "Gaming",         icon: Gamepad2,       href: "/browse?category=17" },
  { label: "Services",       icon: Wrench,         href: "/browse?category=19" },
  { label: "Courses",        icon: GraduationCap,  href: "/browse?category=12" },
  { label: "Artworks",       icon: Palette,        href: "/browse?category=20" },
  { label: "Plug-in",        icon: Plug,           href: "/browse?category=19" },
  { label: "Others",         icon: MoreHorizontal, href: "/browse" },
];

export async function TopNav({ q }: { q?: string } = {}) {
  const me = await getMe();
  const hasStore = Boolean(me?.user?.store);
  const isAdmin = me?.role === "admin";
  const t = getServerT();

  return (
    <header className="sticky top-0 z-40 glass-morphism-strong border-b border-white/6">
      {/* Row 1 */}
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-6">
        <Logo size="md" />

        <SearchPill defaultValue={q ?? ""} />

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href={me ? "/my-reviews" : "/browse?sort=rating"}
            aria-label={me ? t("nav.reviews") : t("nav.topRated")}
            title={me ? t("nav.reviews") : t("nav.topRated")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-metu-yellow hover:bg-white/5 transition"
          >
            <Star className="h-5 w-5" />
          </Link>
          <Link
            href={me ? "/favorites" : "/login?next=/favorites"}
            aria-label={t("nav.favorites")}
            title={t("nav.favorites")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-metu-red hover:bg-white/5 transition"
          >
            <Heart className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            aria-label={t("nav.cart")}
            title={t("nav.cart")}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:text-metu-yellow hover:bg-white/5 transition"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
          <SoundToggle />
          <ThemeToggle />
          {isAdmin && (
            <Link
              href="/admin"
              title={t("nav.admin")}
              className="inline-flex items-center gap-1.5 rounded-pill border border-purple-400/40 bg-purple-400/15 hover:bg-purple-400/25 hover:border-purple-400/60 px-3 py-2 text-sm font-semibold text-purple-200 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              {t("nav.admin")}
            </Link>
          )}
          <AddStoreButton
            loggedIn={Boolean(me)}
            hasStore={hasStore}
            label={hasStore ? t("nav.dashboard") : t("nav.addStore")}
          />
        </div>

        <AuthMenu
          user={me?.user ?? null}
          role={(me?.role as any) ?? null}
          hasStore={hasStore}
        />

        <LocaleSwitcher />
      </div>

      {/* Row 2 — category pill chips */}
      <nav className="mx-auto max-w-[1440px] px-4 md:px-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-2.5">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-metu-yellow/40 hover:text-metu-yellow hover:bg-white/[0.05] transition"
            >
              <t.icon className="h-3.5 w-3.5 text-metu-yellow/80" strokeWidth={2.25} />
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function AddStoreButton({
  loggedIn,
  hasStore,
  label,
}: {
  loggedIn: boolean;
  hasStore: boolean;
  label: string;
}) {
  const href = !loggedIn
    ? "/login?next=/become-seller"
    : hasStore
    ? "/seller"
    : "/become-seller";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-pill button-gradient px-4 py-2 text-sm"
    >
      <Store className="h-4 w-4" />
      {label}
    </Link>
  );
}

// LocaleSwitcher moved to its own client component so it can flip the
// language without a full page reload — see components/LocaleSwitcher.tsx.
