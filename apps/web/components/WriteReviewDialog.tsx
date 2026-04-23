"use client";
import { useEffect, useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { GlassButton } from "./visual/GlassButton";
import { play } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Review = {
  reviewId: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    // userId added so the moderation UI in <Reviews> can compare
    // against the current user and show edit/delete on owned rows.
    // The POST /api/products/[id]/reviews endpoint already includes
    // the full user object — this just widens the type to match.
    userId: number;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    username: string;
  };
};

export function WriteReviewDialog({
  productId,
  onClose,
  onSubmitted,
}: {
  productId: number;
  onClose: () => void;
  onSubmitted: (r: Review) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Confine Tab focus inside the dialog and restore it to the trigger
  // on close — WCAG 2.4.3 / 2.1.2 compliance for modal dialogs.
  const dialogRef = useRef<HTMLFormElement>(null);
  useFocusTrap(dialogRef, true);

  // ESC + body lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setErr("Pick a star rating first");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data?.error === "Unauthorized" ? "Please log in to write a review" : "Failed to post review");
        play("error");
        return;
      }
      const data = await res.json();
      play("review");
      onSubmitted(data.review as Review);
    } catch {
      setErr("Network error");
      play("error");
    } finally {
      setBusy(false);
    }
  }

  const display = hover || rating;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-surface-1/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <form
        ref={dialogRef}
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl glass-morphism-strong p-6 animate-fade-in-up"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-ink-dim hover:text-white hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="font-display text-xl font-bold text-white">Write a review</h3>
        <p className="text-sm text-ink-dim mt-1">
          Share what you think — buyers find honest reviews most helpful.
        </p>

        {/* star picker */}
        <div className="mt-5 flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
              className="p-1 rounded-md hover:bg-white/5 transition"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition",
                  s <= display
                    ? "fill-metu-yellow stroke-metu-yellow"
                    : "fill-white/5 stroke-white/20",
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-ink-secondary tabular-nums">
            {display ? `${display} / 5` : "Pick a rating"}
          </span>
        </div>

        {/* comment */}
        <label className="block mt-5">
          <span className="block text-sm font-semibold text-white mb-1">Your review</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 255))}
            placeholder="What did you think? (max 255 characters)"
            rows={4}
            required
            className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none resize-none"
          />
          <div className="text-[10px] text-ink-dim text-right mt-1">
            {comment.length} / 255
          </div>
        </label>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <GlassButton tone="glass" onClick={onClose} type="button">
            Cancel
          </GlassButton>
          <GlassButton tone="gold" type="submit" disabled={busy}>
            {busy ? "Posting…" : "Post review"}
          </GlassButton>
        </div>
      </form>
    </div>
  );
}
