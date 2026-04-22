import Link from "next/link";
import Image from "next/image";
import { Star, Package, BadgeCheck } from "lucide-react";
import { Badge } from "./ui/Badge";
import { FavoriteButton } from "./FavoriteButton";
import { cn, isDataUrl } from "@/lib/utils";
import { money } from "@/lib/format";

/**
 * Cards render at ~300×225 on desktop and 200×150 on mobile — request a
 * smaller Unsplash variant (instead of the gallery's 1200×800) so /browse
 * doesn't try to decode 30+ MB of pixels into memory at once.
 */
function cardImage(url: string): string {
  if (!url.includes("images.unsplash.com")) return url;
  return url.replace("w=1200", "w=600").replace("h=800", "h=400");
}

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
  isFavorited = false,
}: {
  product: ProductCardProduct;
  className?: string;
  // Hydrated by the server for the logged-in user — drives the heart's
  // initial fill state. Guests default to false and get a redirect on click.
  isFavorited?: boolean;
}) {
  const hasRange = product.maxPrice && product.maxPrice !== product.minPrice;
  return (
    <Link
      href={`/product/${product.productId}`}
      className={cn(
        // `transform-gpu` promotes each card onto its own GPU layer so the
        // hover lift doesn't trigger a full-page repaint of all cards.
        "group relative rounded-2xl glass-morphism overflow-hidden transition-all duration-200 transform-gpu",
        "hover:border-metu-yellow/50 hover:shadow-pop hover:-translate-y-1",
        className,
      )}
    >
      {/* image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/25">
          <Package className="h-10 w-10" strokeWidth={1.5} />
        </div>
        <Image
          src={cardImage(product.image)}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unoptimized={isDataUrl(product.image)}
        />
        {/* discount chip top-left */}
        {product.discountPercent && product.discountPercent > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-metu-red/95 px-2.5 py-0.5 text-xs font-bold text-white shadow-card">
            −{product.discountPercent}%
          </span>
        )}
        {/* Favourite heart + THB currency badge top-right */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <FavoriteButton productId={product.productId} initial={isFavorited} />
          <span className="rounded-full glass-morphism-strong px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-metu-yellow uppercase border border-metu-yellow/30">
            THB
          </span>
        </div>
        {/* gold accent bar at the bottom of the image — friend's signature */}
        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-80 group-hover:opacity-100 group-hover:h-1 transition-all" />
      </div>

      {/* body */}
      <div className="p-4">
        {product.storeName && (
          <div className="text-xs font-medium text-ink-dim mb-1 inline-flex items-center gap-1">
            <BadgeCheck className="h-3 w-3 text-metu-yellow/80" />
            {product.storeName}
          </div>
        )}
        <h3 className="font-display font-semibold text-white line-clamp-2 min-h-[3rem] group-hover:text-metu-yellow transition-colors">
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
            <span className="font-display text-lg font-bold text-gold-gradient">
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
              <Star className="h-3.5 w-3.5 fill-metu-yellow stroke-metu-yellow" />
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
