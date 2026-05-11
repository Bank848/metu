import Link from "next/link";
import Image from "next/image";
import { Star, Package, BadgeCheck, ShoppingCart } from "lucide-react";
import { Badge } from "./ui/Badge";
import { FavoriteButton } from "./FavoriteButton";
import { StoreNameLink } from "./StoreNameLink";
import { SellerLevelBadge } from "./SellerLevelBadge";
import { cn, isDataUrl, cardImage } from "@/lib/utils";
import { coins, thbToCoins } from "@/lib/format";

export type ProductCardProduct = {
  productId: number;
  name: string;
  description?: string;
  minPrice: number;
  maxPrice?: number;
  originalMinPrice?: number;
  originalMaxPrice?: number;
  image: string;
  storeName?: string;
  storeId?: number;
  storeImage?: string;
  /** Computed via v_user_level — seller level 1-5 of the store owner. */
  sellerLevel?: number;
  avgRating?: number;
  reviewCount?: number;
  discountPercent?: number;
  displayCurrency?: string;
  category?: string;
};

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
  isFavorited?: boolean;
  variant?: Variant;
  priority?: boolean;
  disableFavorites?: boolean;
}) {
  const hasDiscount = !!product.discountPercent && product.discountPercent > 0;
  const hasRange = product.maxPrice && product.maxPrice !== product.minPrice;

  const displayMinPrice = hasDiscount
    ? Math.round(product.minPrice * (1 - product.discountPercent! / 100))
    : product.minPrice;

  const displayMaxPrice = hasDiscount && product.maxPrice
    ? Math.round(product.maxPrice * (1 - product.discountPercent! / 100))
    : product.maxPrice;

  const originalPrice = hasDiscount
    ? product.maxPrice ?? Math.round(product.minPrice / (1 - product.discountPercent! / 100))
    : product.maxPrice;
  const isFeature = variant === "feature";
  const eagerLoad = priority || isFeature;
  
  return (
    <Link
      href={`/product/${product.productId}`}
      className={cn(
        "group relative flex flex-col w-full bg-[#1a1a1a] overflow-hidden",
        "hover:ring-2 hover:ring-metu-yellow/40 transition-all duration-300",
        "shadow-2xl border border-white/5",
        className,
      )}
    >
      {/* ── Image ── */}
      <div className={cn(
        "relative w-full overflow-hidden bg-zinc-800",
        isFeature ? "aspect-[16/10]" : "aspect-[4/3]",
      )}>
        {/* Fallback icon */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-metu-yellow/20">
          <Package className={isFeature ? "h-14 w-14" : "h-10 w-10"} strokeWidth={1.5} />
        </div>

        {product.image && (
          <Image
            src={cardImage(product.image)}
            alt={product.name}
            fill
            sizes={isFeature ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 25vw"}
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            unoptimized={isDataUrl(product.image)}
            {...(eagerLoad ? { priority: true } : { loading: "lazy" })}
          />
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

        {/* Category / tag chip — top left */}
        {product.category && (
          <div className="absolute left-3 top-3 p-3 h-5 min-w-[60px] flex items-center justify-center bg-black/70 border border-metu-yellow/50 backdrop-blur-md rounded-full">
            <span className="text-[9px] font-black uppercase text-metu-yellow/90 ">
              {product.category}
            </span>
          </div>
        )}



        {/* Favourite — top right */}
        {!disableFavorites && (
          <div className="absolute top-3 right-3">
            <FavoriteButton productId={product.productId} initial={isFavorited} />
          </div>
        )}

        {/* Currency badge */}
        {product.displayCurrency && product.displayCurrency !== "THB" && (
          <span className="absolute bottom-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-metu-yellow uppercase border border-metu-yellow/30 bg-black/60 backdrop-blur-sm">
            {product.displayCurrency}
          </span>
        )}

        {/* Feature card gold bar */}
        {isFeature && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-80 group-hover:opacity-100 transition-all" />
        )}
      </div>

      {/* ── Body ── */}
      <div className={cn("flex flex-col flex-1", isFeature ? "p-5 md:p-6" : "p-4")}>

        {/* Title & Store */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="flex items-start gap-2">
            <div className="w-1 h-5 bg-metu-yellow rounded-full shadow-[0_0_8px_rgba(255,209,108,0.5)] shrink-0 mt-0.5" />
            <h3 className={cn(
              "font-display font-black text-white leading-tight uppercase tracking-tight line-clamp-2 group-hover:text-metu-yellow transition-colors",
              // min-h คงที่ทำให้ title ทุก card สูงเท่ากัน
              isFeature ? "text-base md:text-lg min-h-[3.5rem]" : "text-[13px] min-h-[2.5rem]",
            )}>
              {product.name}
            </h3>
          </div>

          {/* Store row */}
          <div className="flex items-center gap-2 min-h-[1.5rem]">
            {product.storeName && (
              <>
                <div className="w-5 h-5 rounded-full bg-zinc-700 border border-white/20 overflow-hidden shrink-0 flex items-center justify-center relative">
                  {product.storeImage ? (
                    <Image
                      src={product.storeImage}
                      alt={product.storeName}
                      fill
                      className="object-cover"
                      sizes="20px"
                    />
                  ) : (
                    <span className="text-[8px] font-black text-zinc-300">
                      {product.storeName[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 min-w-0">
                  {product.storeId ? (
                    <StoreNameLink storeId={product.storeId} storeName={product.storeName} />
                  ) : (
                    <span className="text-[11px] font-bold text-zinc-200 truncate">
                      {product.storeName}
                    </span>
                  )}
                  <BadgeCheck className="h-3 w-3 text-blue-400 shrink-0" />
                  {/* Level pill — sits next to the verified tick so a glance
                      tells a buyer how seasoned this shop is. Skipped when
                      the column is missing or 0 (legacy fallbacks). */}
                  <SellerLevelBadge level={product.sellerLevel} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Price + Rating — mt-auto ดันลงล่างเสมอ */}
        <div className="mt-auto pt-1 flex items-end justify-between gap-2">

          {/* ซ้าย: ราคา */}
        <div className="flex flex-col justify-end gap-0.5 min-h-[3rem]">

          {/* ราคาปัจจุบัน (หลังลด) + badge */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-display font-black tracking-tighter italic text-metu-yellow",
              isFeature ? "text-2xl md:text-3xl" : "text-[18px]",
            )}>
              {coins(thbToCoins(product.minPrice))}
              {hasRange && (
                <span className="text-sm font-bold not-italic text-zinc-400 ml-1">
                   – {coins(thbToCoins(product.maxPrice!))}
                </span>
              )}
            </span>

            {hasDiscount && (
              <span className="bg-red-600 px-2 py-1 text-[12px] font-black text-white rounded shadow-lg shadow-red-900/20 leading-none shrink-0">
                {product.discountPercent}%
              </span>
            )}
          </div>

          <div className="min-h-[1rem]">
              {hasDiscount && (product.originalMinPrice ?? product.minPrice) ? (
                <span className="text-[11px] text-zinc-500 font-bold line-through tabular-nums">
                  {coins(thbToCoins(product.originalMinPrice ?? product.minPrice))}
                  {hasRange && product.originalMaxPrice && (
                    ` – ${coins(thbToCoins(product.originalMaxPrice))}`
                  )}
                </span>
              ) : null}
            </div>
        </div>

          {/* ขวา: Rating + Cart */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="min-h-[1.25rem]">
              {product.avgRating !== undefined && (
                <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                  <Star className="h-2.5 w-2.5 fill-amber-400 stroke-amber-400" />
                  <span className="text-[10px] font-black text-zinc-300">
                    {product.avgRating.toFixed(1)}
                  </span>
                  {product.reviewCount !== undefined && (
                    <span className="text-[10px] text-zinc-500 font-bold">
                      ({product.reviewCount})
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </Link>
  );
}