"use client";

import Link from "next/link";
import {
  LayoutGrid, Folder, Tag, Star, StarOff, Download,
  Mail, KeyRound, Play, RotateCcw, ChevronLeft, ChevronRight,
  SlidersHorizontal, Truck,
  // New Icons for Categories
  Box, BookOpen, Type, Gamepad2, PenTool, 
  GraduationCap, Camera, Puzzle, Music, Layers
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string };

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "3D Models": Box,
  "E-books": BookOpen,
  "Fonts": Type,
  "Game Assets": Gamepad2,
  "Illustrations": PenTool,
  "Online Courses": GraduationCap,
  "Photography": Camera,
  "Plug-ins": Puzzle,
  "Stock Music": Music,
  "Templates": Layers,
};

const DELIVERY_ICONS = {
  download:    Download,
  email:       Mail,
  license_key: KeyRound,
  streaming:   Play,
} as const;

const RATING_ICONS = [StarOff, Star, Star, Star] as const;

export function FilterPanel({
  categories,
  tags,
  params,
  activeCategoryId,
}: {
  categories: Category[];
  tags: Tag[];
  params: Record<string, string | undefined>;
  activeCategoryId?: number;
}) {
  const activeCategory =
    activeCategoryId ?? (Number.isFinite(Number(params.category)) ? Number(params.category) : 0);
  const activeTags = (params.tags ?? "").split(",").filter(Boolean);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...overrides })) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    return `/browse?${p.toString()}`;
  };

  return (
    <div className="md:sticky md:top-28 md:overflow-y-auto md:pr-1 scrollbar-hide bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-12 pt-7 pb-4 border-b border-white/5">
        <h3 className="text-white text-[18px] font-black uppercase tracking-tighter">Filters</h3>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
          Refine your search
        </p>
      </div>

      {/* Category Section */}
    <div className="py-4">
        
    <SectionLabel label="Category" icon={LayoutGrid} />
    <nav className="space-y-0.5 px-3">
        <NavRow
        icon={LayoutGrid}
        label="All categories"
        active={!activeCategory}
        href={buildHref({ category: undefined })}
        />
        
        {categories.map((c) => {
        // Find matching icon or fallback to Folder/Box
        const IconComponent = CATEGORY_ICONS[c.categoryName] || Folder;
        
        return (
            <NavRow
            key={c.categoryId}
            icon={IconComponent}
            label={c.categoryName}
            active={activeCategory === c.categoryId}
            href={buildHref({ category: String(c.categoryId) })}
            />
        );
        })}
    </nav>
    </div>

      <Divider />

      {/* Tags */}
      <div className="px-6 py-4">
        <SectionLabel label="Tags" icon={Tag} />
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 12).map((t) => {
            const isActive = activeTags.includes(String(t.tagId));
            const newTags = isActive
              ? activeTags.filter((id) => id !== String(t.tagId))
              : [...activeTags, String(t.tagId)];
            return (
              <Link key={t.tagId} href={buildHref({ tags: newTags.join(",") })} scroll={false}>
                <Badge variant={isActive ? "success" : "mist"}>{t.tagName}</Badge>
              </Link>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Min rating */}
      <div className="px-3 py-4">
        <SectionLabel label="Minimum Rating" icon={Star} className="px-3" />
        <nav className="space-y-0.5">
          <NavRow
            icon={StarOff}
            label="Any rating"
            active={!params.minRating}
            href={buildHref({ minRating: undefined })}
          />
          {([4, 3, 2, 1] as const).map((n, i) => (
            <NavRow
              key={n}
              icon={RATING_ICONS[i] ?? Star}
              label={`${n}★ & up`}
              active={Number(params.minRating) === n}
              href={buildHref({ minRating: String(n) })}
            />
          ))}
        </nav>
      </div>

      <Divider />

      {/* Delivery method */}
      <div className="px-3 py-4">
        <SectionLabel label="Delivery Method" icon={Truck} className="px-3" />
        <nav className="space-y-0.5">
          {(["download", "email", "license_key", "streaming"] as const).map((d) => (
            <NavRow
              key={d}
              icon={DELIVERY_ICONS[d]}
              label={d.replace("_", " ")}
              active={params.delivery === d}
              href={buildHref({ delivery: params.delivery === d ? undefined : d })}
              capitalize
            />
          ))}
        </nav>
      </div>

      {/* Reset */}
      <div className="px-6 pb-6 pt-2">
        <Link
          href="/browse"
          scroll={false}
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-white/5 rounded-lg text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:border-red-500/20 hover:text-red-500 transition-all"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Filters
        </Link>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 mb-2 px-3", className)}>
      <Icon className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{label}</p>
    </div>
  );
}

function NavRow({
  icon: Icon,
  label,
  active,
  href,
  capitalize,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  href: string;
  capitalize?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "flex items-center gap-3 py-2.5 px-4 rounded-xl transition-all duration-200 relative group border-l-4",
        active
          ? "bg-metu-yellow/20 text-metu-yellow border-metu-yellow"
          : "border-transparent text-zinc-500 hover:bg-metu-yellow/10 hover:text-white",
        capitalize && "capitalize",
      )}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
        active && "text-metu-yellow",
      )} />
      <span className={cn(
        "text-[12px] font-black uppercase tracking-tight",
        active ? "text-white" : "group-hover:text-zinc-200",
      )}>
        {label}
      </span>
      {active && (
        <div className="absolute right-4 w-1.5 h-1.5 bg-metu-yellow rounded-full shadow-[0_0_10px_#FFD16C]" />
      )}
    </Link>
  );
}

function Divider() {
  return <div className="mx-6 border-t border-white/5" />;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  const buildHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    qs.set("page", String(p));
    return `/browse?${qs.toString()}`;
  };

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:border-metu-yellow/40 transition"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Link>
      )}
      <span className="px-4 text-sm text-zinc-500">
        Page <span className="text-white font-semibold">{page}</span> of {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:border-metu-yellow/40 transition"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}