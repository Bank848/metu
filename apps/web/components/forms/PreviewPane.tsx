"use client";
import Image from "next/image";
import { Store as StoreIcon, Tag as TagIcon } from "lucide-react";
import { cn, isDataUrl } from "@/lib/utils";
import { coins, thbToCoins, fmtDate } from "@/lib/format";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";

export type ProductPreviewState = {
  name: string;
  description?: string;
  minPrice: number;
  maxPrice?: number;
  image: string;
  storeName?: string;
  discountPercent?: number;
  originalMinPrice?: number;
  originalMaxPrice?: number;
  tags?: string[];
  details?: { detailName?: string; detailValue?: string }[];
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
      {props.variant === "coupon"  && <CouponPreview  state={props.state} />}
    </aside>
  );
}

function ProductPreview({ state }: { state: ProductPreviewState }) {
  const product: ProductCardProduct = {
    productId: 0,
    name: state.name || "Your product name",
    description: state.description,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    originalMinPrice: state.originalMinPrice,
    originalMaxPrice: state.originalMaxPrice,
    image: state.image || "",
    storeName: state.storeName,
    discountPercent: state.discountPercent,
  };

  const visibleDetails = state.details?.filter(d => d.detailName || d.detailValue) ?? [];

  return (
    <div className="pointer-events-none space-y-3">
      <ProductCard product={product} variant="default" />

      {visibleDetails.length > 0 && (
        <div className="surface-flat rounded-xl px-4 py-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-ink-dim font-mono">
            Details
          </p>
          {visibleDetails.map((d, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <span className="text-xs text-ink-secondary shrink-0">{d.detailName}</span>
              <span className="text-xs text-white font-medium text-right">{d.detailValue}</span>
            </div>
          ))}
        </div>
      )}
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

function CouponPreview({ state }: { state: CouponPreviewState }) {
  const parts: string[] = [];
  if (state.discountPercent && state.discountPercent > 0) {
    parts.push(`${state.discountPercent}% off`);
  } else if (state.discountAmount && state.discountAmount > 0) {
    parts.push(`${coins(thbToCoins(state.discountAmount))} off`);
  }
  if (state.minSpend && state.minSpend > 0) {
    parts.push(`min ${coins(thbToCoins(state.minSpend))}`);
  }
  if (state.expiresAt) {
    const date =
      typeof state.expiresAt === "string"
        ? new Date(state.expiresAt)
        : state.expiresAt;
    if (!Number.isNaN(date.getTime())) {
      parts.push(`ends ${fmtDate(date)}`);
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
