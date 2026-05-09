import Link from "next/link";
import {
  Star,
  Heart,
  Store,
  ShieldCheck,
  LayoutGrid,
  Box,
  Gamepad2,
  GraduationCap,
  Palette,
  Plug,
  BookOpen,
  Music,
  Type,
  LayoutTemplate,
  Camera,
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

type Tab = { label: string; icon: any; href: string };

const TABS: Tab[] = [
  { label: "All",            icon: LayoutGrid,     href: "/browse" },
  { label: "3D Models",      icon: Box,            href: "/browse?category=1" },
  { label: "E-books",        icon: BookOpen,       href: "/browse?category=3" },
  { label: "Fonts",          icon: Type,           href: "/browse?category=5" },
  { label: "Game Assets",    icon: Gamepad2,       href: "/browse?category=7" },
  { label: "Illustrations",  icon: Palette,        href: "/browse?category=10" },
  { label: "Online Courses", icon: GraduationCap,  href: "/browse?category=2" },
  { label: "Photography",    icon: Camera,         href: "/browse?category=8" },
  { label: "Plug-ins",       icon: Plug,           href: "/browse?category=9" },
  { label: "Stock Music",    icon: Music,          href: "/browse?category=4" },
  { label: "Templates",      icon: LayoutTemplate, href: "/browse?category=6" },
];

interface  AddStoreProps {
  hasStore: boolean;
  label: string;
}

function AddStoreButton({ hasStore, label }: AddStoreProps) {
  const href = hasStore ? "/seller" : "/become-seller";
  return (
    <Link
      href={href}
      className="glass-pill-btn relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-metu-yellow transition-all duration-300"
    >
      <span
        className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }}
      />
      <Store className="h-4 w-4 relative z-10" />
      <span className="relative z-10 tracking-tight">{label}</span>
    </Link>
  );
}

export async function TopNav({ q }: { q?: string } = {}) {
  const [me, settings] = await Promise.all([getMe(), safeGetSettings()]);
  const hasStore = Boolean(me?.user?.store);
  const isAdmin = me?.role === "admin";

  return (
    <header className="flex flex-col w-full sticky top-0 z-50 glass-morphism-strong border-b border-white/6">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:gap-5 md:px-6">
        <Logo size="md" />

        <SearchPill defaultValue={q ?? ""} />

        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={me ? "/my-reviews" : "/browse?sort=rating"}
              aria-label={me ? "My reviews" : "Top rated"}
              title={me ? "My reviews" : "Top rated"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:text-metu-yellow hover:bg-white/5 transition"
            >
              <Star className="h-[18px] w-[18px]" />
            </Link>
            {settings.favoritesEnabled && (
              <Link
                href={me ? "/favorites" : "/login?next=/favorites"}
                aria-label={"Favorites"}
                title={"Favorites"}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:text-coral hover:bg-coral/5 transition"
              >
                <Heart className="h-[18px] w-[18px]" />
              </Link>
            )}
          </div>

          {/* <div className="flex items-center rounded-full border border-white/8 bg-white/[0.03] px-1 py-1">
            <SoundToggle inCluster />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
            <ThemeToggle inCluster />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
            <LocaleSwitcher inCluster />
          </div> */}

          {me && (
            <>
              <CartNavIcon />

              <AddStoreButton
                hasStore={hasStore}
                label={hasStore ? "Dashboard" : "Add Store"}
              />
            </>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              title={"Admin"}
              className="inline-flex items-center gap-1.5 rounded-pill border border-purple-400/40 bg-purple-400/15 hover:bg-purple-400/25 hover:border-purple-400/60 px-3 py-2 text-sm font-semibold text-purple-200 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              {"Admin"}
            </Link>
          )}
        </div>

        <AuthMenu
          user={me?.user ?? null}
          role={(me?.role as any) ?? null}
          hasStore={hasStore}
        />
      </div>

      <nav className="relative z-1 h-[47px] w-full bg-zinc-600/20 backdrop-blur-[5px] flex items-center px-3 md:px-[89px]">
        <div className="no-scrollbar flex items-center md:mx-auto gap-2 overflow-x-auto py-2.5">
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-metu-yellow transition"
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
