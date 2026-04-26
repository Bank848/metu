import Link from "next/link";
import Image from "next/image";
import { Star, Package, BadgeCheck } from "lucide-react";
import { Badge } from "./ui/Badge";
import { FavoriteButton } from "./FavoriteButton";
import { CompareToggle } from "./CompareDrawer";
import { StoreNameLink } from "./StoreNameLink";
import { cn, isDataUrl, cardImage } from "@/lib/utils";
import { money } from "@/lib/format";

export type ProductCardProduct = {
  productId: number;
  name: string;
  description?: string;
  minPrice: number;
  maxPrice?: number;
  image: string;
  storeName?: string;
  // Phase 11 / F13 — when present, the seller attribution under the
  // card title becomes a clickable `<StoreNameLink>` instead of plain
  // text. Optional because some surfaces (the seller form preview, see
  // `forms/PreviewPane.tsx`) don't carry a real store yet.
  storeId?: number;
  avgRating?: number;
  reviewCount?: number;
  discountPercent?: number;
  tags?: string[];
  // Wave-3 / F21: opt-in currency badge. Default behaviour is "THB" — the
  // only currency the marketplace handles today — and we hide the pill
  // when the value matches because the price is already rendered with
  // the ฿ glyph (see `lib/format.ts#money`). The render path is kept so
  // a future multi-currency catalogue can pass `displayCurrency: "USD"`
  // (etc.) without touching this component again.
  displayCurrency?: string;
};

/**
 * Phase 9 / Wave 2 — variant prop added.
 *
 *   - `default` (grid card) — drops `glass-morphism` for the cheaper
 *     `surface-flat`, smaller `rounded-xl`, no gold hairline. This kills
 *     the "every card is a glassy 2xl rectangle with a gold underline"
 *     AI-grid feel called out at design-system.md §1 row 1.
 *   - `feature` (hero card) — uses the `surface-accent` (mint) tint, keeps
 *     `rounded-2xl` and the gold hairline so it visibly outranks the rest
 *     of the grid. The parent controls layout (e.g. `col-span-2`); we
 *     only stretch the image-aspect a little so the card reads bigger.
 *
 * The discount badge moved off the gold-gradient text (illegible at
 * small sizes) onto a solid coral chip — coral is our "hot / promo"
 * signal and stays distinct from `metu-red` (destructive).
 */
type Variant = "default" | "feature";

export function ProductCard({
  product,
  className,
  isFavorited = false,
  variant = "default",
  priority = false,
}: {
  product: ProductCardProduct;
  className?: string;
  // Hydrated by the server for the logged-in user — drives the heart's
  // initial fill state. Guests default to false and get a redirect on click.
  isFavorited?: boolean;
  variant?: Variant;
  // Phase 11 / F4 — Above-the-fold hint. When `true`, the card image is
  // marked as a `priority` resource for next/image, which preloads it via
  // `<link rel="preload">` and drops the default `loading="lazy"`. Pass it
  // for the first row of `/browse` and the lead card on the home grid so
  // the cold-navigate "placeholder cube → real image" pop disappears. The
  // `feature` variant on home is the LCP element and defaults to high
  // priority automatically.
  priority?: boolean;
}) {
  const hasRange = product.maxPrice && product.maxPrice !== product.minPrice;
  const isFeature = variant === "feature";
  // The home-page editorial card IS the LCP element on `/`, so default it
  // to priority even when the parent forgets to pass the prop. Grid cards
  // stay opt-in via `priority` so we don't preload the entire page.
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
        {/* Phase 11 / F16 — only render the <Image> when we actually
            have a src. The seller new-product LIVE PREVIEW pane was
            mounting `<Image src="">` while the form was empty, which
            in Next/Image surfaces as the browser's broken-image icon
            and clashed with the green Package placeholder underneath.
            With this guard the placeholder cube wins until the seller
            pastes a URL or uploads a file. */}
        {product.image && (
          <Image
            src={cardImage(product.image)}
            alt={product.name}
            fill
            sizes={isFeature ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 25vw"}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized={isDataUrl(product.image)}
            // Phase 11 / F4 — above-the-fold tiles preload (priority) and
            // drop lazy-loading; the rest stay lazy by default so the
            // browser doesn't fetch every off-screen thumbnail at once.
            {...(eagerLoad ? { priority: true } : { loading: "lazy" })}
          />
        )}
        {/* discount chip top-left — solid coral fill, readable at any size */}
        {product.discountPercent && product.discountPercent > 0 && (
          <span className="absolute top-3 left-3 rounded-md bg-coral px-2 py-0.5 text-[11px] font-bold text-coral-deep shadow-flat">
            −{product.discountPercent}%
          </span>
        )}
        {/* Favourite heart + Compare toggle + (optional) currency badge
            top-right. The currency pill renders only when the product's
            displayCurrency is something OTHER than THB — every price in
            the catalogue today is THB and prefixed with ฿, so the pill
            was pure visual noise (F21). The render path stays so a
            future non-THB product can opt back in by setting
            `displayCurrency` on the row. */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <CompareToggle productId={product.productId} />
          <FavoriteButton productId={product.productId} initial={isFavorited} />
          {product.displayCurrency && product.displayCurrency !== "THB" && (
            <span className="rounded-full glass-morphism-strong px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-metu-yellow uppercase border border-metu-yellow/30">
              {product.displayCurrency}
            </span>
          )}
        </div>
        {/* gold accent bar — kept on the feature card only (playbook §9) */}
        {isFeature && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-80 group-hover:opacity-100 group-hover:h-1 transition-all" />
        )}
      </div>

      {/* body */}
      <div className={isFeature ? "p-5 md:p-6" : "p-4"}>
        {product.storeName && (
          <div className="mb-1">
            {product.storeId ? (
              <StoreNameLink storeId={product.storeId} storeName={product.storeName} />
            ) : (
              // Fallback for surfaces that synthesise a card without a
              // real store — keeps the visual identical to the link form
              // so the layout doesn't shift between the two cases.
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-dim">
                <BadgeCheck className="h-3 w-3 text-metu-yellow/80" />
                {product.storeName}
              </span>
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
                "font-display font-bold text-gold-gradient",
                isFeature ? "text-2xl md:text-3xl" : "text-lg",
              )}
            >
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
