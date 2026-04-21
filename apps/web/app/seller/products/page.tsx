import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/EmptyState";
import { apiAuth } from "@/lib/session";
import { money } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";

type Product = {
  productId: number;
  name: string;
  description: string;
  category: { categoryName: string };
  items: Array<{ price: string | number; discountPercent: number; deliveryMethod: string }>;
  images: Array<{ productImage: string }>;
  _count: { reviews: number };
};

export const dynamic = "force-dynamic";

export default async function SellerProducts() {
  const products = (await apiAuth<Product[]>("/seller/products")) ?? [];

  return (
    <>
      <PageHeader
        title="Your products"
        subtitle={`${products.length} products listed in your store`}
        action={
          <Button variant="primary" href="/seller/products/new">
            + New product
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first digital product to start selling."
          icon={<Package className="h-8 w-8" />}
          action={<Button href="/seller/products/new">Create product →</Button>}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-space-850 overflow-hidden">
          <table className="w-full">
            <thead className="bg-space-800 text-xs font-semibold uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Variants</th>
                <th className="text-left px-5 py-3">Price range</th>
                <th className="text-left px-5 py-3">Reviews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const prices = p.items.map((i) => Number(i.price));
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return (
                  <tr key={p.productId} className="hover:bg-white/5">
                    <td className="px-5 py-3">
                      <Link href={`/product/${p.productId}`} className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-lg bg-space-900 overflow-hidden shrink-0 border border-line">
                          {p.images[0] && <Image src={p.images[0].productImage} alt="" fill sizes="48px" className="object-cover" unoptimized={isDataUrl(p.images[0].productImage)} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate max-w-[280px]">{p.name}</div>
                          <div className="text-xs text-ink-dim truncate max-w-[280px]">{p.description}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="mist">{p.category.categoryName}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-white">{p.items.length}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-brand-yellow">
                      {money(min)}{min !== max && ` – ${money(max)}`}
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-secondary">{p._count.reviews}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
