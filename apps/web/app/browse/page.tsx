import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { browseProducts, getCategories, getTags, getFavoriteSet, getTopSellerProducts } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { RecentStrip } from "./RecentStrip";
import { SortSelect } from "./SortSelect";
import { BrowseFiltersSheet } from "./BrowseFiltersSheet";
import { Filter, Package, Sparkles } from "lucide-react";

type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string };

const SAFE_SORT = ["newest", "price_asc", "price_desc", "rating"] as const;
type SortKey = (typeof SAFE_SORT)[number];

/** Type guard that narrows a raw query-string value to the SortKey enum,
 *  falling back to the default. Replaces the previous `as any` cast. */
function parseSort(v: string | undefined): SortKey {
  return (SAFE_SORT as readonly string[]).includes(v ?? "") ? (v as SortKey) : "newest";
}

/**
 * Resolve `?category=` to a categoryId. Accepts either a numeric id or
 * a slug-style name, looking the latter up against the cached category
 * list. Returns `undefined` when unknown so the caller treats it as
 * "no category filter."
 */
function resolveCategoryId(
  raw: string | undefined,
  categories: ReadonlyArray<Category>,
): number | undefined {
  if (!raw) return undefined;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;
  const hit = categories.find(
    (c) => c.categoryName.trim().toLowerCase() === normalized,
  );
  return hit?.categoryId;
}

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const me = await getMe();
  const [categories, tags, favSet, topSellerProducts] = await Promise.all([
    getCategories(),
    getTags(),
    getFavoriteSet(me?.user.userId),
    // Only show the "From top sellers" carousel on the unfiltered first
    // page — once a buyer is searching or filtering they want focused
    // results, not a marketing strip.
    Object.keys(searchParams).length === 0 ? getTopSellerProducts(8) : Promise.resolve([]),
  ]);
  const categoryId = resolveCategoryId(searchParams.category, categories);
  const result = await browseProducts({
    category: categoryId,
    tags: searchParams.tags,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    delivery: searchParams.delivery,
    q: searchParams.q,
    sort: parseSort(searchParams.sort),
    page: searchParams.page ? Math.max(1, Number(searchParams.page)) : 1,
    pageSize: 16,
    minRating: searchParams.minRating ? Number(searchParams.minRating) : undefined,
  });

  const activeSort = searchParams.sort ?? "newest";
  const activeQ = searchParams.q ?? "";

  // Count active filters for the mobile sheet trigger badge.
  // Excludes `q` (search) and `sort`/`page` (presentation state).
  const activeFilterCount =
    (searchParams.category ? 1 : 0) +
    (searchParams.tags ? searchParams.tags.split(",").filter(Boolean).length : 0) +
    (searchParams.minRating ? 1 : 0) +
    (searchParams.delivery ? 1 : 0);

  return (
    <>
      <TopNav q={activeQ} />
      <main id="main" className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-10 py-6 sm:py-10">
        <PageHeader
          title={activeQ ? `Results for “${activeQ}”` : "Browse the marketplace"}
          subtitle={
            activeQ
              ? `${result.total.toLocaleString()} matching products`
              : `${result.total.toLocaleString()} digital products and services from independent creators`
          }
        />

        {/* `minmax(0,1fr)` floors the column min at 0 so the inner
            auto-fill product grid can't push the layout past the viewport. */}
        <div className="grid md:grid-cols-[260px_minmax(0,1fr)] gap-6 md:gap-8">
          {/* Sidebar is desktop-only; mobile uses <BrowseFiltersSheet>. */}
          <aside className="hidden md:block">
            <FilterPanel
              categories={categories}
              tags={tags}
              params={searchParams}
              activeCategoryId={categoryId}
            />
          </aside>

          <section>
            {/* Sort row: SortSelect auto-submits via router.push() and the
                sidebar filters are instant-nav anchor links, so the bar is
                a plain flex container with the mobile filter trigger inline. */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <BrowseFiltersSheet activeCount={activeFilterCount}>
                <FilterPanel
                  categories={categories}
                  tags={tags}
                  params={searchParams}
                  activeCategoryId={categoryId}
                />
              </BrowseFiltersSheet>
              <span className="text-xs font-medium text-ink-dim mr-2">Sort</span>
              <SortSelect activeSort={activeSort} />
              {(activeQ || searchParams.category || searchParams.tags || searchParams.delivery) && (
                <Link
                  href="/browse"
                  scroll={false}
                  className="ml-auto rounded-full border border-line px-4 py-2 text-sm text-ink-secondary hover:text-white hover:border-brand-yellow/40"
                >
                  Clear all filters
                </Link>
              )}
            </div>

            {/* "From top sellers" — only on the unfiltered first page,
                rendered ABOVE the regular grid so high-tier creators
                surface immediately. Hidden when there's a search/filter
                active so it doesn't dilute focused results. */}
            {topSellerProducts.length > 0 && (
              <section className="mb-8 rounded-2xl border border-metu-yellow/30 bg-gradient-to-br from-metu-yellow/5 to-transparent p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-metu-yellow" />
                  <h2 className="font-display text-lg font-extrabold text-white">From top sellers</h2>
                  <Badge variant="gold" className="text-[10px]">Lv.3+</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {topSellerProducts.map((p) => (
                    <ProductCard
                      key={p.productId}
                      product={p as never}
                      isFavorited={favSet.has(p.productId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {result.items.length === 0 ? (
              activeQ ? (
                <EmptyState
                  variant="noResults"
                  title={`No products match “${activeQ}”`}
                  description="Try different keywords or clear some filters."
                  action={<Button href="/browse">Browse all →</Button>}
                />
              ) : (
                <EmptyState
                  title="No products match those filters"
                  description="Try different keywords or clear some filters."
                  icon={<Package className="h-8 w-8" />}
                  action={<Button href="/browse">Browse all →</Button>}
                />
              )
            ) : (
              // `auto-fill` + minmax(230px) keeps card count close to the
              // old 3/4/5 breakpoints while preventing orphan slots when
              // pageSize doesn't divide the active column count.
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
                {result.items.map((p, i) => (
                  // Only the LCP hero tile gets `priority`. Stacking
                  // multiple priority+fill <Image> nodes triggers React
                  // #418/#422 in Next 14 App Router.
                  <ProductCard
                    key={p.productId}
                    product={p}
                    isFavorited={favSet.has(p.productId)}
                    priority={i === 0}
                  />
                ))}
              </div>
            )}

            {result.totalPages > 1 && (
              <Pagination page={result.page} totalPages={result.totalPages} params={searchParams} />
            )}

            {/* Personal recently-viewed strip (hydrates from localStorage). */}
            <RecentStrip />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function FilterPanel({
  categories,
  tags,
  params,
  activeCategoryId,
}: {
  categories: Category[];
  tags: Tag[];
  params: Record<string, string | undefined>;
  // Pre-resolved on the server. Accepts both slug (`?category=fonts`) and
  // legacy numeric (`?category=35`) forms.
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

  // Mint-accented active row distinguishes selected filters from the
  // metu-yellow primary CTA colour.
  const activeRowClass =
    "bg-mint/15 text-mint font-semibold border border-mint/30";
  const idleRowClass =
    "border border-transparent text-ink-secondary hover:bg-white/5 hover:text-white";

  return (
    // Sticky sidebar with max-height + scroll so a tall filter list
    // doesn't run off-screen on shorter laptops.
    <div className="space-y-4 md:sticky md:top-28 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto md:pr-1">
      <div className="surface-flat rounded-2xl p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-mint" /> Category
        </h3>
        <ul className="space-y-0.5">
          <li>
            <Link
              href={buildHref({ category: undefined })}
              scroll={false}
              className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                !activeCategory ? activeRowClass : idleRowClass
              }`}
            >
              All categories
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.categoryId}>
              <Link
                href={buildHref({ category: String(c.categoryId) })}
                scroll={false}
                className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                  activeCategory === c.categoryId ? activeRowClass : idleRowClass
                }`}
              >
                {c.categoryName}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Tag chips */}
      <div className="surface-flat rounded-xl p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
          Tags
        </h3>
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

      <div className="surface-flat rounded-xl p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
          Minimum rating
        </h3>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              href={buildHref({ minRating: undefined })}
              scroll={false}
              className={`block rounded-lg px-3 py-1.5 transition ${
                !params.minRating ? activeRowClass : idleRowClass
              }`}
            >
              Any rating
            </Link>
          </li>
          {[4, 3, 2, 1].map((n) => (
            <li key={n}>
              <Link
                href={buildHref({ minRating: String(n) })}
                scroll={false}
                className={`block rounded-lg px-3 py-1.5 transition ${
                  Number(params.minRating) === n ? activeRowClass : idleRowClass
                }`}
              >
                {n}★ &amp; up
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Delivery panel uses the smallest radius (lg) — the radius
          step-down (2xl → xl → xl → lg) gives the sidebar a deliberate
          rhythm instead of four identical 2xl rectangles. */}
      <div className="surface-flat rounded-lg p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
          Delivery method
        </h3>
        <ul className="space-y-0.5 text-sm">
          {["download", "email", "license_key", "streaming"].map((d) => (
            <li key={d}>
              <Link
                href={buildHref({ delivery: params.delivery === d ? undefined : d })}
                scroll={false}
                className={`block rounded-lg px-3 py-1.5 capitalize transition ${
                  params.delivery === d ? activeRowClass : idleRowClass
                }`}
              >
                {d.replace("_", " ")}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Pagination({
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
    // Pagination keeps scroll-to-top so a new page lands at the top.
    // Only the sidebar filter toggles preserve scroll.
    <div className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-brand-yellow/50">
          ← Prev
        </Link>
      )}
      <span className="px-4 text-sm text-ink-secondary">
        Page <span className="text-white font-semibold">{page}</span> of {totalPages}
      </span>
      {page < totalPages && (
        <Link href={buildHref(page + 1)} className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-brand-yellow/50">
          Next →
        </Link>
      )}
    </div>
  );
}
