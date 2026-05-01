import Link from "next/link";
import {
  Star,
  Heart,
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
import { CartNavIcon } from "./CartNavIcon";
import { getMe } from "@/lib/session";
import { safeGetSettings } from "@/lib/settings";
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
  // Read feature flags in parallel with getMe.
  const [me, settings] = await Promise.all([getMe(), safeGetSettings()]);
  const hasStore = Boolean(me?.user?.store);
  const isAdmin = me?.role === "admin";
  const t = getServerT();

  return (
    <header className="sticky top-0 z-40 glass-morphism-strong border-b border-white/6">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:gap-5 md:px-6">
        <Logo size="md" />

        <SearchPill defaultValue={q ?? ""} />

        {/* Action stack: activity icons | control cluster | primary CTA. */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={me ? "/my-reviews" : "/browse?sort=rating"}
              aria-label={me ? t("nav.reviews") : t("nav.topRated")}
              title={me ? t("nav.reviews") : t("nav.topRated")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:text-metu-yellow hover:bg-white/5 transition"
            >
              <Star className="h-[18px] w-[18px]" />
            </Link>
            {/* Heart hides when admin disables favourites; the
                /favorites route is server-gated too. */}
            {settings.favoritesEnabled && (
              <Link
                href={me ? "/favorites" : "/login?next=/favorites"}
                aria-label={t("nav.favorites")}
                title={t("nav.favorites")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:text-coral hover:bg-coral/5 transition"
              >
                <Heart className="h-[18px] w-[18px]" />
              </Link>
            )}
            {/* Client component so the badge updates on cart:update. */}
            <CartNavIcon />
          </div>

          {/* Sound + Theme + Locale share one shell so they read as one control. */}
          <div className="flex items-center rounded-full border border-white/8 bg-white/[0.03] px-1 py-1">
            <SoundToggle inCluster />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
            <ThemeToggle inCluster />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
            <LocaleSwitcher inCluster />
          </div>

          {/* Admin pill + Add Store / Dashboard. */}
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
          {/* Guests don't see the Add Store CTA. */}
          {me && (
            <AddStoreButton
              hasStore={hasStore}
              label={hasStore ? t("nav.dashboard") : t("nav.addStore")}
            />
          )}
        </div>

        {/* Auth menu — sits outside the cluster because the avatar IS
            the visual anchor; pulling it into the cluster shell would
            crowd the user's face. */}
        <AuthMenu
          user={me?.user ?? null}
          role={(me?.role as any) ?? null}
          hasStore={hasStore}
        />
      </div>

      <nav className="mx-auto max-w-[1440px] px-4 md:px-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-2.5">
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-metu-yellow/40 hover:text-metu-yellow hover:bg-white/[0.05] transition"
            >
              <tab.icon className="h-3.5 w-3.5 text-metu-yellow/80" strokeWidth={2.25} />
              <span>{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function AddStoreButton({
  hasStore,
  label,
}: {
  hasStore: boolean;
  label: string;
}) {
  // Caller in <TopNav> already gates this on `me` being truthy (F11),
  // so we no longer render a /login bounce route here.
  const href = hasStore ? "/seller" : "/become-seller";
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
