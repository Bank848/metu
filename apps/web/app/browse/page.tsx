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
import { SortSelect } from "./SortSelect";
import { BrowseFiltersSheet } from "./BrowseFiltersSheet";
import { Filter, Package, Sparkles } from "lucide-react";
import { FilterPanel, Pagination } from "./FilterPanel";


type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string };

const SAFE_SORT = ["newest", "price_asc", "price_desc", "rating"] as const;
type SortKey = (typeof SAFE_SORT)[number];

function parseSort(v: string | undefined): SortKey {
  return (SAFE_SORT as readonly string[]).includes(v ?? "") ? (v as SortKey) : "newest";
}

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
    Object.keys(searchParams).length === 0 ? getTopSellerProducts(8) : Promise.resolve([]),
  ]);

  const categoryId = resolveCategoryId(searchParams.category, categories);

  const result = await browseProducts({
    category: categoryId,
    tags: searchParams.tags,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    originalMinPrice: searchParams.originalMinPrice ? Number(searchParams.originalMinPrice) : undefined,
    originalMaxPrice: searchParams.originalMaxPrice ? Number(searchParams.originalMaxPrice) : undefined,
    delivery: searchParams.delivery,
    q: searchParams.q,
    shop: searchParams.shop,
    sort: parseSort(searchParams.sort),
    page: searchParams.page ? Math.max(1, Number(searchParams.page)) : 1,
    pageSize: 16,
    minRating: searchParams.minRating ? Number(searchParams.minRating) : undefined,
  });

  const activeSort = searchParams.sort ?? "newest";
  const activeQ = searchParams.q ?? "";

  const activeFilterCount =
    (searchParams.category ? 1 : 0) +
    (searchParams.tags ? searchParams.tags.split(",").filter(Boolean).length : 0) +
    (searchParams.minRating ? 1 : 0) +
    (searchParams.delivery ? 1 : 0);

  return (
    <>
      <TopNav q={activeQ} />

      <div className="flex min-h-screen">

        {/* ── LEFT: Fixed filter sidebar ── */}
        <aside className="hidden md:flex flex-col w-[260px] shrink-0">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide border-r border-white/5 bg-[#0a0a0a]">
            <FilterPanel
              categories={categories}
              tags={tags}
              params={searchParams}
              activeCategoryId={categoryId}
            />
          </div>
        </aside>

        {/* ── RIGHT: Main content ── */}
        <main id="main" className="flex-1 min-w-0 px-4 sm:px-6 md:px-8 py-6 sm:py-10">

          <PageHeader
            title={activeQ ? `Results for "${activeQ}"` : "Browse the marketplace"}
            subtitle={
              activeQ
                ? `${result.total.toLocaleString()} matching products`
                : `${result.total.toLocaleString()} digital products and services from independent creators`
            }
          />

          {/* Sort + mobile filter row */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <BrowseFiltersSheet activeCount={activeFilterCount}>
              <FilterPanel
                categories={categories}
                tags={tags}
                params={searchParams}
                activeCategoryId={categoryId}
              />
            </BrowseFiltersSheet>
            <span className="text-xs font-medium text-ink-dim mr-1">Sort</span>
            <SortSelect activeSort={activeSort} />
            {(activeQ || searchParams.category || searchParams.tags || searchParams.delivery) && (
              <Link
                href="/browse"
                scroll={false}
                className="ml-auto rounded-full border border-white/10 px-4 py-2 text-sm text-ink-secondary hover:text-white hover:border-metu-yellow/40 transition"
              >
                Clear all filters
              </Link>
            )}
          </div>

          {/* Top sellers strip */}
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

          {/* Product grid / empty state */}
          {result.items.length === 0 ? (
            activeQ ? (
              <EmptyState
                variant="noResults"
                title={`No products match "${activeQ}"`}
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
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-5">
              {result.items.map((p, i) => (
                <ProductCard
                  key={p.productId}
                  product={p as any}
                  isFavorited={favSet.has(p.productId)}
                  priority={i === 0}
                />
              ))}
            </div>
          )}

          {result.totalPages > 1 && (
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              params={searchParams}
            />
          )}
        </main>
      </div>

      <Footer />
    </>
  );
}
