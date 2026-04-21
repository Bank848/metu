import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { browseProducts, getCategories, getTags } from "@/lib/server/queries";
import { Filter, Package, SearchX } from "lucide-react";

type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string };

const SAFE_SORT = ["newest", "price_asc", "price_desc", "rating"] as const;

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const [result, categories, tags] = await Promise.all([
    browseProducts({
      category: searchParams.category ? Number(searchParams.category) : undefined,
      tags: searchParams.tags,
      minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
      maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
      delivery: searchParams.delivery,
      q: searchParams.q,
      sort: SAFE_SORT.includes(searchParams.sort as any)
        ? (searchParams.sort as any)
        : "newest",
      page: searchParams.page ? Math.max(1, Number(searchParams.page)) : 1,
      pageSize: 16,
    }),
    getCategories(),
    getTags(),
  ]);

  const activeSort = searchParams.sort ?? "newest";
  const activeQ = searchParams.q ?? "";

  return (
    <>
      <TopNav q={activeQ} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-10 py-10">
        <PageHeader
          title={activeQ ? `Results for “${activeQ}”` : "Browse the marketplace"}
          subtitle={
            activeQ
              ? `${result.total.toLocaleString()} matching products`
              : `${result.total.toLocaleString()} digital products and services from independent creators`
          }
        />

        <div className="grid md:grid-cols-[260px_1fr] gap-8">
          <aside>
            <FilterPanel categories={categories} tags={tags} params={searchParams} />
          </aside>

          <section>
            <form className="mb-4 flex flex-wrap items-center gap-2" action="/browse" method="get">
              {Object.entries(searchParams).map(([k, v]) => {
                if (k === "sort" || !v) return null;
                return <input key={k} type="hidden" name={k} value={v} />;
              })}
              <span className="text-xs font-medium text-ink-dim mr-2">Sort</span>
              <select
                name="sort"
                defaultValue={activeSort}
                className="rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white focus:border-brand-yellow outline-none"
              >
                <option value="newest">Newest</option>
                <option value="rating">Top rated</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
              </select>
              <button type="submit" className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-space-black hover:bg-brand-yellowDark">
                Apply
              </button>
              {(activeQ || searchParams.category || searchParams.tags || searchParams.delivery) && (
                <a
                  href="/browse"
                  className="ml-auto rounded-full border border-line px-4 py-2 text-sm text-ink-secondary hover:text-white hover:border-brand-yellow/40"
                >
                  Clear all filters
                </a>
              )}
            </form>

            {result.items.length === 0 ? (
              <EmptyState
                title={activeQ ? `No products match “${activeQ}”` : "No products match those filters"}
                description="Try different keywords or clear some filters."
                icon={activeQ ? <SearchX className="h-8 w-8" /> : <Package className="h-8 w-8" />}
                action={<Button href="/browse">Browse all →</Button>}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {result.items.map((p) => (
                  <ProductCard key={p.productId} product={p} />
                ))}
              </div>
            )}

            {result.totalPages > 1 && (
              <Pagination page={result.page} totalPages={result.totalPages} params={searchParams} />
            )}
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
}: {
  categories: Category[];
  tags: Tag[];
  params: Record<string, string | undefined>;
}) {
  const activeCategory = Number(params.category);
  const activeTags = (params.tags ?? "").split(",").filter(Boolean);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...overrides })) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    return `/browse?${p.toString()}`;
  };

  return (
    <div className="space-y-5 sticky top-28">
      <div className="rounded-2xl border border-line bg-space-850 p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5" /> Category
        </h3>
        <ul className="space-y-0.5">
          <li>
            <a
              href={buildHref({ category: undefined })}
              className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                !activeCategory ? "bg-brand-yellow/15 text-brand-yellow font-semibold" : "text-ink-secondary hover:bg-white/5 hover:text-white"
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
                  activeCategory === c.categoryId ? "bg-brand-yellow/15 text-brand-yellow font-semibold" : "text-ink-secondary hover:bg-white/5 hover:text-white"
                }`}
              >
                {c.categoryName}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-space-850 p-5">
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
                <Badge variant={isActive ? "yellow" : "mist"}>{t.tagName}</Badge>
              </a>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-space-850 p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
          Delivery method
        </h3>
        <ul className="space-y-0.5 text-sm">
          {["download", "email", "license_key", "streaming"].map((d) => (
            <li key={d}>
              <a
                href={buildHref({ delivery: params.delivery === d ? undefined : d })}
                className={`block rounded-lg px-3 py-1.5 capitalize transition ${
                  params.delivery === d ? "bg-brand-yellow/15 text-brand-yellow font-semibold" : "text-ink-secondary hover:bg-white/5 hover:text-white"
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
