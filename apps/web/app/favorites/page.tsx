import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { getFavoriteProducts } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/favorites");

  const products = await getFavoriteProducts(me.user.userId);

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1280px] px-6 md:px-10 py-10">
        <PageHeader
          title="Your favourites"
          subtitle={`${products.length} product${products.length === 1 ? "" : "s"} saved`}
        />

        {products.length === 0 ? (
          <EmptyState
            title="No favourites yet"
            description="Tap the heart on any product to save it here for later."
            icon={<Heart className="h-8 w-8" />}
            action={<GlassButton tone="gold" href="/browse">Browse marketplace →</GlassButton>}
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
