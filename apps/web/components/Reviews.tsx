"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Star, Pencil, MessageSquare } from "lucide-react";
import { GlassButton } from "./visual/GlassButton";
import { WriteReviewDialog } from "./WriteReviewDialog";
import { cn, isDataUrl } from "@/lib/utils";

type Review = {
  reviewId: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    username: string;
  };
};

type SortKey = "newest" | "highest" | "lowest";

export function Reviews({
  productId,
  initialReviews,
  avgRating,
  reviewCount,
  canWrite,
}: {
  productId: number;
  initialReviews: Review[];
  avgRating?: number;
  reviewCount: number;
  canWrite: boolean;
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [sort, setSort] = useState<SortKey>("newest");
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...reviews];
    if (sort === "highest") copy.sort((a, b) => b.rating - a.rating);
    else if (sort === "lowest") copy.sort((a, b) => a.rating - b.rating);
    else copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return copy;
  }, [reviews, sort]);

  // Live distribution from current list (better feedback than ignoring sort)
  const dist = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // index 0 = 1★, index 4 = 5★
    for (const r of reviews) buckets[Math.max(0, Math.min(4, r.rating - 1))]++;
    const total = reviews.length || 1;
    return buckets.map((c) => ({ count: c, pct: (c / total) * 100 }));
  }, [reviews]);

  const onSubmitted = (r: Review) => {
    setReviews((prev) => [r, ...prev]);
    setOpen(false);
  };

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl glass-morphism p-10 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-metu-yellow/15 text-metu-yellow">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h3 className="font-display font-bold text-white text-lg">No reviews yet</h3>
        <p className="text-sm text-ink-secondary mt-1 mb-6">
          Be the first to share what you think about this product.
        </p>
        {canWrite ? (
          <GlassButton tone="gold" onClick={() => setOpen(true)}>
            <Pencil className="h-4 w-4" /> Write the first review
          </GlassButton>
        ) : (
          <GlassButton tone="glass" href="/login">
            Log in to write a review
          </GlassButton>
        )}
        {open && (
          <WriteReviewDialog productId={productId} onClose={() => setOpen(false)} onSubmitted={onSubmitted} />
        )}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      {/* Aggregate panel (left) */}
      <aside className="rounded-2xl glass-morphism p-5 h-fit lg:sticky lg:top-32">
        <div className="text-center pb-4 border-b border-white/8">
          <div className="font-display text-5xl font-extrabold text-gold-gradient">
            {(avgRating ?? 0).toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-4 w-4",
                  i < Math.round(avgRating ?? 0)
                    ? "fill-metu-yellow stroke-metu-yellow"
                    : "fill-white/10 stroke-white/15",
                )}
              />
            ))}
          </div>
          <div className="text-xs text-ink-dim mt-1">
            {reviewCount.toLocaleString()} reviews
          </div>
        </div>
        <div className="space-y-1.5 mt-4">
          {[5, 4, 3, 2, 1].map((s) => {
            const d = dist[s - 1];
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-ink-secondary">{s}</span>
                <Star className="h-3 w-3 fill-metu-yellow stroke-metu-yellow" />
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-metu-yellow to-metu-gold"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-ink-dim">{d.count}</span>
              </div>
            );
          })}
        </div>
        {canWrite ? (
          <GlassButton tone="gold" fullWidth className="mt-5" onClick={() => setOpen(true)}>
            <Pencil className="h-4 w-4" /> Write a review
          </GlassButton>
        ) : (
          <GlassButton tone="glass" fullWidth className="mt-5" href="/login">
            Log in to write a review
          </GlassButton>
        )}
      </aside>

      {/* List (right) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-ink-secondary">
            Showing {sorted.length} of {reviewCount}
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-white/10 bg-surface-2 px-3 py-1.5 text-xs text-white focus:border-metu-yellow outline-none"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>
        <ul className="grid md:grid-cols-2 gap-4">
          {sorted.map((r) => (
            <li key={r.reviewId} className="rounded-2xl glass-morphism p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative h-9 w-9 rounded-full bg-metu-yellow overflow-hidden">
                  {r.user.profileImage && (
                    <Image
                      src={r.user.profileImage}
                      alt={r.user.username}
                      fill
                      sizes="36px"
                      className="object-cover"
                      unoptimized={isDataUrl(r.user.profileImage)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {r.user.firstName} {r.user.lastName}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < r.rating
                              ? "fill-metu-yellow stroke-metu-yellow"
                              : "fill-white/10 stroke-white/15",
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-ink-dim ml-1">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink-secondary leading-relaxed">{r.comment}</p>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <WriteReviewDialog productId={productId} onClose={() => setOpen(false)} onSubmitted={onSubmitted} />
      )}
    </div>
  );
}
