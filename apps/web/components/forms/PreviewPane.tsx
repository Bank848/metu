"use client";
import Image from "next/image";
import { Store as StoreIcon, Tag as TagIcon } from "lucide-react";
import { cn, isDataUrl } from "@/lib/utils";
import { money } from "@/lib/format";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/messages";

/**
 * Phase 10 / Step 2 — live render of how the marketplace will show the
 * thing being edited.
 *
 * Three variants today:
 *
 *   - product → renders the real `<ProductCard variant="default">`
 *     against the form state, so a seller sees the actual card update
 *     as they type. Pulling in the real component (rather than a
 *     replica) means the preview can never drift from production.
 *   - store   → cover + profile + name preview, modelled on the inline
 *     preview at EditStoreForm.tsx:80–106 but extracted so future store
 *     forms can reuse it without copying markup.
 *   - coupon  → coral pill summarising code + discount + minimum spend
 *     + expiry. Coral because coupons are the "hot promo" signal in the
 *     palette (see globals.css §coral).
 *
 * The pane is sticky-friendly: callers in a two-column grid can wrap
 * with `<div className="sticky top-32">` (or pass the class via
 * `className`) so the preview stays in view while the form scrolls.
 */
export type ProductPreviewState = {
  name: string;
  description?: string;
  minPrice: number;
  maxPrice?: number;
  image: string;
  storeName?: string;
  discountPercent?: number;
  tags?: string[];
};

export type StorePreviewState = {
  name: string;
  description: string;
  profileImage: string;
  coverImage: string;
};

export type CouponPreviewState = {
  code: string;
  discountPercent?: number;
  discountAmount?: number;
  minSpend?: number;
  expiresAt?: string | Date | null;
};

export type PreviewPaneProps =
  | { variant: "product"; state: ProductPreviewState; className?: string }
  | { variant: "store";   state: StorePreviewState;   className?: string }
  | { variant: "coupon";  state: CouponPreviewState;  className?: string };

export function PreviewPane(props: PreviewPaneProps) {
  const { locale } = useI18n();
  return (
    <aside
      className={cn("space-y-2", props.className)}
      aria-label={`${props.variant} preview`}
    >
      <div className="text-[10px] uppercase tracking-wider text-ink-dim font-semibold">
        Live preview
      </div>
      {props.variant === "product" && <ProductPreview state={props.state} />}
      {props.variant === "store"   && <StorePreview   state={props.state} />}
      {props.variant === "coupon"  && <CouponPreview  state={props.state} locale={locale} />}
    </aside>
  );
}

/**
 * Map our app `Locale` to a BCP-47 tag for `Intl.DateTimeFormat`. We pass
 * an explicit tag (rather than `undefined`) so the seller sees dates in
 * the locale they picked in the TopNav, not whatever their OS happens to
 * default to. We also pin Asia/Bangkok because the marketplace is
 * Bangkok-first and coupon end-dates are stored as wall-clock dates in
 * that timezone.
 */
function bcp47(locale: Locale): string {
  return locale === "th" ? "th-TH" : "en-US";
}

/** Renders the real ProductCard so the preview never diverges from the
 *  shipped grid card. We synthesise the productId because ProductCard's
 *  href requires one — anchored to 0, the preview link goes nowhere
 *  meaningful, but ProductCard renders identically. */
function ProductPreview({ state }: { state: ProductPreviewState }) {
  const product: ProductCardProduct = {
    productId: 0,
    name: state.name || "Your product name",
    description: state.description,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    image: state.image || "",
    storeName: state.storeName,
    discountPercent: state.discountPercent,
    tags: state.tags,
  };
  return (
    <div className="pointer-events-none">
      <ProductCard product={product} variant="default" />
    </div>
  );
}

/** Lifted from EditStoreForm.tsx:80–106 — same markup, no behaviour. */
function StorePreview({ state }: { state: StorePreviewState }) {
  return (
    <section className="surface-flat rounded-2xl overflow-hidden">
      <div className="relative aspect-[5/2] bg-surface-2 overflow-hidden">
        {state.coverImage ? (
          <Image
            src={state.coverImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized={isDataUrl(state.coverImage)}
          />
        ) : (
          <div className="absolute inset-0 vibrant-mesh" />
        )}
      </div>
      <div className="p-5 flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-metu-yellow overflow-hidden ring-2 ring-surface-1 -mt-12 shadow-raised">
          {state.profileImage ? (
            <Image
              src={state.profileImage}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized={isDataUrl(state.profileImage)}
            />
          ) : (
            <StoreIcon className="h-6 w-6 m-5 text-surface-1" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display text-xl font-bold text-white truncate">
            {state.name || "Your store name"}
          </div>
          <div className="text-sm text-ink-secondary line-clamp-2">
            {state.description || "Your tagline / description shows here."}
          </div>
        </div>
      </div>
    </section>
  );
}

function CouponPreview({ state, locale }: { state: CouponPreviewState; locale: Locale }) {
  const parts: string[] = [];
  if (state.discountPercent && state.discountPercent > 0) {
    parts.push(`${state.discountPercent}% off`);
  } else if (state.discountAmount && state.discountAmount > 0) {
    parts.push(`${money(state.discountAmount)} off`);
  }
  if (state.minSpend && state.minSpend > 0) {
    parts.push(`min ${money(state.minSpend)}`);
  }
  if (state.expiresAt) {
    const date =
      typeof state.expiresAt === "string"
        ? new Date(state.expiresAt)
        : state.expiresAt;
    if (!Number.isNaN(date.getTime())) {
      // Pass the active app locale (was `undefined` → OS locale, F17) and
      // pin Asia/Bangkok so the "ends" pill is stable regardless of the
      // viewer's machine clock zone.
      parts.push(
        `ends ${date.toLocaleDateString(bcp47(locale), {
          month: "short",
          day: "numeric",
          timeZone: "Asia/Bangkok",
        })}`
      );
    }
  }
  const summary = parts.length > 0 ? parts.join(", ") : "no discount set";
  const code = state.code || "CODE";

  return (
    <div className="surface-accent surface-accent--coral rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-coral/20 text-coral border border-coral/30">
          <TagIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-lg font-bold text-coral uppercase tracking-wider">
            {code}
          </div>
          <div className="text-xs text-ink-secondary mt-0.5">
            {summary}
          </div>
        </div>
      </div>
    </div>
  );
}
