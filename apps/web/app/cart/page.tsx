import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
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
    storeName: string;
    image: string | null;
    deliveryMethod: string;
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
      <main className="mx-auto max-w-6xl px-6 md:px-8 py-10">
        <PageHeader title="Your cart" subtitle="Review your items and apply a coupon before checking out." />

        {!cart || cart.items.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            description="Explore the marketplace and add digital products you love."
            icon={<ShoppingCart className="h-8 w-8" />}
            action={<Button href="/browse">Browse marketplace →</Button>}
          />
        ) : (
          <CartLines cart={cart} />
        )}
      </main>
      <Footer />
    </>
  );
}
