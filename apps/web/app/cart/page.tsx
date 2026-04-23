import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { ProductCard } from "@/components/ProductCard";
import { apiAuth, getMe } from "@/lib/session";
import { getFeaturedProducts, getFavoriteSet } from "@/lib/server/queries";
import { getServerT } from "@/lib/i18n/server";
import { CartLines } from "./CartLines";

type Cart = {
  cartId: number;
  subtotal: number;
  items: Array<{
    cartItemId: number;
    productItemId: number;
    productId: number;
    productName: string;
    storeId: number;
    storeName: string;
    image: string | null;
    deliveryMethod: string;
    stock: number;
    unitPrice: number;
    basePrice: number;
    discountPercent: number;
    quantity: number;
    lineTotal: number;
  }>;
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/cart");

  const cart = await apiAuth<Cart>("/cart");
  const isEmpty = !cart || cart.items.length === 0;
  const t = getServerT();

  // Empty carts: surface a handful of trending products + any the buyer
  // already favourited (marked with a filled heart) so there's always
  // something to click. Cheap extra Promise.all only when the cart is
  // empty — full carts skip these queries entirely.
  //
  // Note: an earlier audit flagged these as "redundant under
  // force-dynamic" — that was a false alarm. Neither getFeaturedProducts
  // nor getFavoriteSet is wrapped in unstable_cache (verify in
  // lib/server/queries.ts), so the route's `force-dynamic` flag and
  // these direct Prisma calls don't conflict. Each request re-runs them.
  const [recommended, favSet] = isEmpty
    ? await Promise.all([getFeaturedProducts(8), getFavoriteSet(me.user.userId)])
    : [[] as Awaited<ReturnType<typeof getFeaturedProducts>>, new Set<number>()];

  return (
    <>
      <TopNav />
      {/* vibrant mesh subtly behind the page */}
      <main id="main" className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[600px] vibrant-mesh opacity-50 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 md:px-8 py-10">
          <PageHeader
            title={t("cart.title")}
            subtitle="Review your items and apply a coupon before checking out."
          />

          {isEmpty ? (
            <>
              {/* Wave-3: variant="cart" picks up the new EmptyCart
                  illustration (mint-tinted) so the empty state doesn't
                  read as a generic icon-in-circle. */}
              <EmptyState
                variant="cart"
                title={t("cart.empty.title")}
                description={t("cart.empty.description")}
                action={<GlassButton tone="gold" href="/browse">{t("cart.empty.cta")} →</GlassButton>}
              />

              {/* Inline recommendations so the user can fill the cart
                  without leaving the page. */}
              {recommended.length > 0 && (
                <section className="mt-12">
                  <div className="flex items-end justify-between mb-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-metu-yellow">
                        <Sparkles className="h-3.5 w-3.5" />
                        You might like
                      </div>
                      <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
                        Popular right now
                      </h2>
                    </div>
                    <GlassButton tone="glass" size="sm" href="/browse">
                      See all →
                    </GlassButton>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {recommended.map((p) => (
                      <ProductCard key={p.productId} product={p} isFavorited={favSet.has(p.productId)} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <CartLines cart={cart} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
