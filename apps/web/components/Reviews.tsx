"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Star, Pencil, MessageSquare, Trash2, Shield } from "lucide-react";
import { GlassButton } from "./visual/GlassButton";
import { EmptyState } from "./EmptyState";
import { WriteReviewDialog } from "./WriteReviewDialog";
import { ConfirmDialog } from "./forms/ConfirmDialog";
import { cn, isDataUrl } from "@/lib/utils";

type Review = {
  reviewId: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    // userId is needed to gate self-edit/delete (review author can
    // always touch their own; admin can touch anyone's).
    userId: number;
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
  isAdmin = false,
  currentUserId,
}: {
  productId: number;
  initialReviews: Review[];
  avgRating?: number;
  reviewCount: number;
  canWrite: boolean;
  // Moderation gates — passed from the product page based on `getMe()`.
  // Admin sees edit/delete on every review (with a coral badge).
  // The review's author sees edit/delete only on their own row.
  isAdmin?: boolean;
  currentUserId?: number;
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [sort, setSort] = useState<SortKey>("newest");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Phase 11 / F19 — destructive moderation now flows through the
  // in-app <ConfirmDialog> primitive instead of native window.confirm().
  // Carries the row's reviewId so the modal knows which row to delete.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

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

  /** Delete a review — admin or owner only. The row is hard-deleted
   *  (no soft-delete column on ProductReview), so the trash icon opens
   *  a <ConfirmDialog> first; this handler runs only after the user
   *  confirms in the modal. */
  async function deleteReview(reviewId: number) {
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setReviews((prev) => prev.filter((r) => r.reviewId !== reviewId));
    }
    setPendingDeleteId(null);
  }

  /** Save inline edits — admin or owner only. Optimistic update on 200. */
  async function saveEdit(reviewId: number, rating: number, comment: string) {
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rating, comment }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setReviews((prev) =>
      prev.map((r) =>
        r.reviewId === reviewId
          ? { ...r, rating: data.review.rating, comment: data.review.comment }
          : r,
      ),
    );
    setEditingId(null);
  }

  if (reviews.length === 0) {
    // Wave-3: pass through to EmptyState so the new illustration system
    // owns the empty case (matches the cart-empty / no-results treatment).
    return (
      <>
        <EmptyState
          title="No reviews yet"
          description="Be the first to share what you think about this product."
          icon={<MessageSquare className="h-6 w-6" />}
          action={
            canWrite ? (
              <GlassButton tone="gold" onClick={() => setOpen(true)}>
                <Pencil className="h-4 w-4" /> Write the first review
              </GlassButton>
            ) : (
              <GlassButton tone="glass" href="/login">
                Log in to write a review
              </GlassButton>
            )
          }
        />
        {open && (
          <WriteReviewDialog productId={productId} onClose={() => setOpen(false)} onSubmitted={onSubmitted} />
        )}
      </>
    );
  }

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      {/* Aggregate panel (left) — Wave-3: surface-flat instead of glass */}
      <aside className="rounded-2xl surface-flat p-5 h-fit lg:sticky lg:top-32 shadow-flat">
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
          {sorted.map((r) => {
            const isOwner = currentUserId !== undefined && r.user.userId === currentUserId;
            const canModerate = isAdmin || isOwner;
            const isEditing = editingId === r.reviewId;
            return (
              <li key={r.reviewId} className="rounded-2xl surface-flat p-5 shadow-flat lift-on-hover hover:shadow-raised">
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
                  {/* Moderation cluster: edit + delete. Visible to the
                      review's author OR any admin. Admin gets a small
                      coral "Admin" pip so the action is clearly a
                      moderation event, not a self-edit. */}
                  {canModerate && !isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && !isOwner && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md bg-coral/10 border border-coral/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coral"
                          title="Admin moderation — actions are audit-logged"
                        >
                          <Shield className="h-3 w-3" /> mod
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingId(r.reviewId)}
                        aria-label="Edit review"
                        title="Edit review"
                        className="p-1.5 rounded-md text-ink-dim hover:text-metu-yellow hover:bg-white/5 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(r.reviewId)}
                        aria-label="Delete review"
                        title="Delete review"
                        className="p-1.5 rounded-md text-ink-dim hover:text-coral hover:bg-coral/5 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <InlineEditForm
                    initialRating={r.rating}
                    initialComment={r.comment}
                    onCancel={() => setEditingId(null)}
                    onSave={(rating, comment) => saveEdit(r.reviewId, rating, comment)}
                  />
                ) : (
                  <p className="text-sm text-ink-secondary leading-relaxed">{r.comment}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {open && (
        <WriteReviewDialog productId={productId} onClose={() => setOpen(false)} onSubmitted={onSubmitted} />
      )}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this review?"
        body="This cannot be undone. The review and its rating are removed from the product immediately."
        confirmLabel="Delete review"
        tone="destructive"
        onConfirm={() => {
          if (pendingDeleteId !== null) return deleteReview(pendingDeleteId);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}

/**
 * Inline edit form for reviews — replaces the comment paragraph with
 * a star picker + textarea. Lives inside the review card so the user
 * doesn't lose the surrounding context while editing.
 */
function InlineEditForm({
  initialRating,
  initialComment,
  onCancel,
  onSave,
}: {
  initialRating: number;
  initialComment: string;
  onCancel: () => void;
  onSave: (rating: number, comment: string) => Promise<void> | void;
}) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (comment.trim().length === 0) return;
        setBusy(true);
        await onSave(rating, comment.trim());
        setBusy(false);
      }}
      className="space-y-2"
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
            className="p-0.5 rounded hover:bg-white/5"
          >
            <Star
              className={cn(
                "h-4 w-4",
                s <= rating
                  ? "fill-metu-yellow stroke-metu-yellow"
                  : "fill-white/10 stroke-white/15",
              )}
            />
          </button>
        ))}
        <span className="ml-1 text-xs text-ink-secondary">{rating} / 5</span>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 255))}
        rows={3}
        className="w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-sm text-white focus:border-metu-yellow outline-none"
        maxLength={255}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-ink-dim font-mono mr-auto">{comment.length} / 255</span>
        <GlassButton tone="glass" size="sm" type="button" onClick={onCancel}>
          Cancel
        </GlassButton>
        <GlassButton tone="gold" size="sm" type="submit" disabled={busy || comment.trim().length === 0}>
          {busy ? "Saving…" : "Save"}
        </GlassButton>
      </div>
    </form>
  );
}
