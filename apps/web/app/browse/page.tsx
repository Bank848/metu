import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { browseProducts, getCategories, getTags, getFavoriteSet } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { RecentStrip } from "./RecentStrip";
import { SortSelect } from "./SortSelect";
import { Filter, Package } from "lucide-react";

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
 * Resolve `?category=` to a categoryId.
 *
 * Phase 11 / F3 — historically this used `Number(searchParams.category)`
 * which silently coerced non-numeric slugs to `NaN` and dropped the
 * filter, so /browse?category=fonts returned the unfiltered grid. We now
 * accept either the numeric categoryId or a slug-style name and look the
 * latter up against the existing categories list (already cached for an
 * hour by `getCategories()`, so the lookup is a pure in-memory match).
 *
 * Returns `undefined` when the slug is unknown — the caller treats that
 * as "no category filter" rather than throwing, mirroring how every
 * other browse param is forgiving of bad input.
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
  // Categories are needed to resolve `?category=<slug>` (F3) before we
  // can dispatch browseProducts, but the lookup is a 1-hour cache hit
  // so the wait is essentially free.
  const [categories, tags, favSet] = await Promise.all([
    getCategories(),
    getTags(),
    getFavoriteSet(me?.user.userId),
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

  return (
    <>
      <TopNav q={activeQ} />
      <main id="main" className="mx-auto max-w-[1440px] px-6 md:px-10 py-10">
        <PageHeader
          title={activeQ ? `Results for “${activeQ}”` : "Browse the marketplace"}
          subtitle={
            activeQ
              ? `${result.total.toLocaleString()} matching products`
              : `${result.total.toLocaleString()} digital products and services from independent creators`
          }
        />

        {/* Phase 11.1 hotfix — `1fr` is shorthand for `minmax(auto,1fr)`,
            and `auto` lets the column grow past 1fr when its contents
            overflow. The inner product grid uses
            `grid-cols-[repeat(auto-fill,minmax(230px,1fr))]` which
            packs as many 230px tracks as fit, so on wide viewports it
            was pushing the right column past the viewport edge.
            `minmax(0,1fr)` floors the minimum at 0 so the column
            constrains and the inner grid wraps to the actual width. */}
        <div className="grid md:grid-cols-[260px_minmax(0,1fr)] gap-8">
          <aside>
            <FilterPanel
              categories={categories}
              tags={tags}
              params={searchParams}
              activeCategoryId={categoryId}
            />
          </aside>

          <section>
            {/* Phase 11 / F11 — Sort row no longer wraps a submit
                button. F22 (run #1) wired the dropdown to auto-submit
                via `router.push()`, which made the adjacent yellow
                "Apply" button dead UI: clicking it after a sort change
                fired a no-op submit because the URL had already been
                updated. Filters in the sidebar are anchor links
                (instant nav), so there's nothing left for the form to
                batch — we render the bar as a flex container instead.
                Hidden inputs that used to preserve other params are
                gone for the same reason: SortSelect builds the next
                URL from `window.location` directly. */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-dim mr-2">Sort</span>
              <SortSelect activeSort={activeSort} />
              {(activeQ || searchParams.category || searchParams.tags || searchParams.delivery) && (
                <a
                  href="/browse"
                  className="ml-auto rounded-full border border-line px-4 py-2 text-sm text-ink-secondary hover:text-white hover:border-brand-yellow/40"
                >
                  Clear all filters
                </a>
              )}
            </div>

            {result.items.length === 0 ? (
              activeQ ? (
                // Search-with-no-results — opt into the Wave-2 `noResults`
                // variant so the bespoke <NoResults /> illustration replaces
                // the lucide SearchX icon. Keeps the empty state visually
                // distinct from the "filters returned nothing" state below.
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
              // Wave-3 / F18: drop the fixed 2/3/4/4/5 column template
              // for `auto-fill` + `minmax`. The previous template left a
              // 2-column gap on the final row whenever
              // `result.items.length` wasn't a multiple of the active
              // breakpoint's column count (e.g. pageSize=16 against 3
              // cols → orphan card). `auto-fill` lets the browser drop
              // the trailing slot when the row would otherwise stretch
              // a card into giant whitespace, so the grid balances
              // itself on every page size. The 230px min was chosen so
              // the card count per row matches the previous breakpoints
              // (3 at md, 4 at lg, 5 at 2xl) within ~5% — no visible
              // layout shift for full pages. Mobile (<480px) drops to a
              // single column at this min, matching `grid-cols-1`
              // rather than the previous `grid-cols-2`; a 2-column
              // layout at 320px wide produced cards too narrow to read.
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
                {result.items.map((p, i) => (
                  // Phase 11 / F4 — first row of tiles preloads. The grid
                  // is `auto-fill,minmax(230px,1fr)` so the column count
                  // depends on viewport width; 4 covers the common
                  // `lg`/`xl` breakpoints (1280–1535px renders 4-up,
                  // ≥1536px renders 5-up where the 5th tile still gets a
                  // late `loading="lazy"` and is fine — preloading 5
                  // would push the budget too far for the rare wide
                  // viewport). Below the fold stays lazy.
                  <ProductCard
                    key={p.productId}
                    product={p}
                    isFavorited={favSet.has(p.productId)}
                    priority={i < 4}
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
  // Pre-resolved on the server — accepts the slug-style `?category=fonts`
  // path as well as the legacy numeric `?category=35` (Phase 11 / F3).
  // Falls back to coercing `params.category` directly so any in-flight
  // numeric URL keeps working without a hydration mismatch.
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

  // Wave-3 visual: filter cards now use `surface-flat` (no glassy
  // backdrop-blur) with mixed radii — the category panel is the
  // anchor card (`rounded-2xl`) while the chip groups land on smaller
  // `rounded-xl` and `rounded-lg` so the sidebar reads as a layered
  // stack rather than four identical glass squares. Active filters
  // pick up the new mint accent so the "what's selected" signal is
  // visually distinct from the metu-yellow primary CTA colour.
  const activeRowClass =
    "bg-mint/15 text-mint font-semibold border border-mint/30";
  const idleRowClass =
    "border border-transparent text-ink-secondary hover:bg-white/5 hover:text-white";

  return (
    <div className="space-y-4 sticky top-28">
      <div className="surface-flat rounded-2xl p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-mint" /> Category
        </h3>
        <ul className="space-y-0.5">
          <li>
            <a
              href={buildHref({ category: undefined })}
              className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                !activeCategory ? activeRowClass : idleRowClass
              }`}
            >
              All categories
            </a>
          </li>
          {categories.map((c) => (
            <li key={c.categoryId}>
              <a
                href={buildHref({ category: String(c.categoryId) })}
                className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                  activeCategory === c.categoryId ? activeRowClass : idleRowClass
                }`}
              >
                {c.categoryName}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Tag chips — smaller radius (xl) than the anchor card (2xl) so
          the sidebar mixes radii per playbook §4. Active chips switch
          to the new `success` (mint) Badge variant. */}
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
              <a key={t.tagId} href={buildHref({ tags: newTags.join(",") })}>
                <Badge variant={isActive ? "success" : "mist"}>{t.tagName}</Badge>
              </a>
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
            <a
              href={buildHref({ minRating: undefined })}
              className={`block rounded-lg px-3 py-1.5 transition ${
                !params.minRating ? activeRowClass : idleRowClass
              }`}
            >
              Any rating
            </a>
          </li>
          {[4, 3, 2, 1].map((n) => (
            <li key={n}>
              <a
                href={buildHref({ minRating: String(n) })}
                className={`block rounded-lg px-3 py-1.5 transition ${
                  Number(params.minRating) === n ? activeRowClass : idleRowClass
                }`}
              >
                {n}★ &amp; up
              </a>
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
              <a
                href={buildHref({ delivery: params.delivery === d ? undefined : d })}
                className={`block rounded-lg px-3 py-1.5 capitalize transition ${
                  params.delivery === d ? activeRowClass : idleRowClass
                }`}
              >
                {d.replace("_", " ")}
              </a>
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
    <div className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <a href={buildHref(page - 1)} className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-brand-yellow/50">
          ← Prev
        </a>
      )}
      <span className="px-4 text-sm text-ink-secondary">
        Page <span className="text-white font-semibold">{page}</span> of {totalPages}
      </span>
      {page < totalPages && (
        <a href={buildHref(page + 1)} className="rounded-full border border-line px-4 py-2 text-sm text-white hover:border-brand-yellow/50">
          Next →
        </a>
      )}
    </div>
  );
}
