import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { apiAuth, getMe } from "@/lib/session";
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

  return (
    <>
      <TopNav />
      {/* vibrant mesh subtly behind the page */}
      <main className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[600px] vibrant-mesh opacity-50 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 md:px-8 py-10">
          <PageHeader
            title="Your cart"
            subtitle="Review your items and apply a coupon before checking out."
          />

          {!cart || cart.items.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              description="Explore the marketplace and add digital products you love."
              icon={<ShoppingCart className="h-8 w-8" />}
              action={<GlassButton tone="gold" href="/browse">Browse marketplace →</GlassButton>}
            />
          ) : (
            <CartLines cart={cart} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
