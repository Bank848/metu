import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { Badge } from "./ui/Badge";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";

export type ProductCardProduct = {
  productId: number;
  name: string;
  description?: string;
  minPrice: number;
  maxPrice?: number;
  image: string;
  storeName?: string;
  avgRating?: number;
  reviewCount?: number;
  discountPercent?: number;
  tags?: string[];
};

export function ProductCard({
  product,
  className,
}: {
  product: ProductCardProduct;
  className?: string;
}) {
  const hasRange = product.maxPrice && product.maxPrice !== product.minPrice;
  return (
    <Link
      href={`/product/${product.productId}`}
      className={cn(
        "group rounded-2xl bg-space-850 border border-line overflow-hidden transition-all duration-200",
        "hover:border-brand-yellow/50 hover:shadow-pop hover:-translate-y-1",
        className,
      )}
    >
      <div className="relative aspect-[4/3] bg-space-900 overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.discountPercent && product.discountPercent > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-brand-yellow px-2.5 py-0.5 text-xs font-bold text-space-black">
            −{product.discountPercent}%
          </span>
        )}
      </div>
      <div className="p-4">
        {product.storeName && (
          <div className="text-xs font-medium text-ink-dim mb-1">
            {product.storeName}
          </div>
        )}
        <h3 className="font-display font-semibold text-white line-clamp-2 min-h-[3rem] group-hover:text-brand-yellow">
          {product.name}
        </h3>
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {product.tags.slice(0, 2).map((t) => (
              <Badge key={t} variant="mist" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="font-display text-lg font-bold text-brand-yellow">
              {money(product.minPrice)}
            </span>
            {hasRange && (
              <span className="text-xs text-ink-dim ml-1">
                – {money(product.maxPrice!)}
              </span>
            )}
          </div>
          {product.avgRating !== undefined && (
            <div className="flex items-center gap-0.5 text-xs font-medium text-ink-secondary">
              <Star className="h-3.5 w-3.5 fill-brand-yellow stroke-brand-yellow" />
              <span>{product.avgRating.toFixed(1)}</span>
              {product.reviewCount !== undefined && (
                <span className="text-ink-dim">({product.reviewCount})</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
