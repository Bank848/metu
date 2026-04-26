import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { getFavoriteProducts } from "@/lib/server/queries";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/favorites");

  const products = await getFavoriteProducts(me.user.userId);
  const t = getServerT();

  // Subtitle picks the right plural form for the current locale rather
  // than splicing English plural-`s` onto a translated string.
  const subtitleKey =
    products.length === 0
      ? "favorites.subtitle.zero"
      : products.length === 1
        ? "favorites.subtitle.one"
        : "favorites.subtitle.many";

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1280px] px-6 md:px-10 py-10">
        <PageHeader
          title={t("favorites.title")}
          subtitle={t(subtitleKey, { count: products.length })}
        />

        {products.length === 0 ? (
          // Wave-3: noResults variant picks up the new coral-tinted
          // illustration so the empty favorites screen lands in the
          // same family as cart-empty and search-no-results.
          <EmptyState
            variant="noResults"
            title={t("favorites.empty.title")}
            description={t("favorites.empty.description")}
            action={<GlassButton tone="gold" href="/browse">{t("favorites.empty.cta")}</GlassButton>}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((p) => (
              <ProductCard key={p.productId} product={p} isFavorited />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
