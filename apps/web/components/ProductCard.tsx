import Link from "next/link";
import Image from "next/image";
import { Star, Package, BadgeCheck } from "lucide-react";
import { Badge } from "./ui/Badge";
import { FavoriteButton } from "./FavoriteButton";
import { CompareToggle } from "./CompareDrawer";
import { StoreNameLink } from "./StoreNameLink";
import { cn, isDataUrl, cardImage } from "@/lib/utils";
import { coins, thbToCoins } from "@/lib/format";

export type ProductCardProduct = {
  productId: number;
  name: string;
  description?: string;
  minPrice: number;
  maxPrice?: number;
  image: string;
  storeName?: string;
  /** When set, store attribution becomes a StoreNameLink. */
  storeId?: number;
  /** Owner's sellerLevel from user_stats — drives the chip beside store name. */
  sellerLevel?: number;
  avgRating?: number;
  reviewCount?: number;
  discountPercent?: number;
  tags?: string[];
  /** Optional currency badge; pill hides when "THB" since price already shows ฿. */
  displayCurrency?: string;
};

/**
 * default = flat grid card; feature = mint accent + gold hairline.
 * Discount badge sits on a coral chip (the "promo" signal).
 */
type Variant = "default" | "feature";

export function ProductCard({
  product,
  className,
  isFavorited = false,
  variant = "default",
  priority = false,
  disableFavorites = false,
}: {
  product: ProductCardProduct;
  className?: string;
  /** Initial heart-fill state for the logged-in user. */
  isFavorited?: boolean;
  variant?: Variant;
  /** Above-the-fold hint; passes priority to next/image. */
  priority?: boolean;
  /** Hides the heart entirely when admin disables favourites. */
  disableFavorites?: boolean;
}) {
  const hasRange = product.maxPrice && product.maxPrice !== product.minPrice;
  const isFeature = variant === "feature";
  // Feature card auto-promotes to priority (it's the LCP on /).
  const eagerLoad = priority || isFeature;
  return (
    <Link
      href={`/product/${product.productId}`}
      className={cn(
        // `transform-gpu` promotes each card onto its own GPU layer so the
        // hover lift doesn't trigger a full-page repaint of all cards.
        "group relative overflow-hidden transform-gpu lift-on-hover hover:shadow-raised",
        isFeature
          ? "rounded-2xl surface-accent hover:border-mint/45"
          : "rounded-xl surface-flat hover:border-metu-yellow/40",
        className,
      )}
    >
      {/* image */}
      <div
        className={cn(
          "relative overflow-hidden bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1",
          isFeature ? "aspect-[16/10]" : "aspect-[4/3]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/25">
          <Package className={isFeature ? "h-14 w-14" : "h-10 w-10"} strokeWidth={1.5} />
        </div>
        {/* Only render <Image> when we actually have a src; otherwise
            the placeholder Package icon shows through. */}
        {product.image && (
          <Image
            src={cardImage(product.image)}
            alt={product.name}
            fill
            sizes={isFeature ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 25vw"}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized={isDataUrl(product.image)}
            {...(eagerLoad ? { priority: true } : { loading: "lazy" })}
          />
        )}
        {/* discount chip top-left — solid coral fill, readable at any size */}
        {product.discountPercent && product.discountPercent > 0 && (
          <span className="absolute top-3 left-3 rounded-md bg-coral px-2 py-0.5 text-[11px] font-bold text-coral-deep shadow-flat">
            −{product.discountPercent}%
          </span>
        )}
        {/* Heart + compare toggle + optional currency badge. */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <CompareToggle productId={product.productId} />
          {!disableFavorites && (
            <FavoriteButton productId={product.productId} initial={isFavorited} />
          )}
          {product.displayCurrency && product.displayCurrency !== "THB" && (
            <span className="rounded-full glass-morphism-strong px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-metu-yellow uppercase border border-metu-yellow/30">
              {product.displayCurrency}
            </span>
          )}
        </div>
        {/* Gold accent bar - feature card only. */}
        {isFeature && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-80 group-hover:opacity-100 group-hover:h-1 transition-all" />
        )}
      </div>

      {/* body */}
      <div className={isFeature ? "p-5 md:p-6" : "p-4"}>
        {product.storeName && (
          <div className="mb-1 flex items-center gap-1.5 flex-wrap">
            {product.storeId ? (
              <StoreNameLink storeId={product.storeId} storeName={product.storeName} />
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-dim">
                <BadgeCheck className="h-3 w-3 text-metu-yellow/80" />
                {product.storeName}
              </span>
            )}
            {product.sellerLevel != null && product.sellerLevel > 0 && (
              <Badge variant="gold" className="text-[9px] !px-1.5 !py-0">
                ⭐ Lv.{product.sellerLevel}
              </Badge>
            )}
          </div>
        )}
        <h3
          className={cn(
            "font-display font-semibold text-white line-clamp-2 group-hover:text-metu-yellow transition-colors",
            isFeature ? "text-xl md:text-2xl min-h-[3.5rem]" : "min-h-[3rem]",
          )}
        >
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
            <span
              className={cn(
                "font-display font-bold text-gold-gradient tabular-nums",
                isFeature ? "text-2xl md:text-3xl" : "text-lg",
              )}
            >
              {coins(thbToCoins(product.minPrice))}
            </span>
            {hasRange && (
              <span className="text-xs text-ink-dim ml-1 tabular-nums">
                – {coins(thbToCoins(product.maxPrice!))}
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
