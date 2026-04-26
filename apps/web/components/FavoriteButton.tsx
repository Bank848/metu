"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

/**
 * Heart toggle. Optimistic: flips instantly on click, reverts on failure.
 * `initial` comes from the server so the first paint has the right state.
 * Auth-gated: a 401 redirects to /login with a next= back to the current
 * page.
 */
export function FavoriteButton({
  productId,
  initial,
  size = "sm",
  className,
}: {
  productId: number;
  initial: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [favorited, setFavorited] = useState(initial);
  const [busy, setBusy] = useState(false);

  const dims = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconDims = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  async function toggle(e: React.MouseEvent) {
    // Prevent the click from bubbling into a parent <Link> when the heart
    // lives inside a ProductCard.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const prev = favorited;
    const next = !favorited;
    setFavorited(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/favorites/${productId}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        const here = typeof window !== "undefined" ? window.location.pathname : "/";
        router.push(`/login?next=${encodeURIComponent(here)}`);
        setFavorited(prev);
        return;
      }
      if (!res.ok) setFavorited(prev);
    } catch {
      setFavorited(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorited ? t("favorite.remove") : t("favorite.add")}
      className={cn(
        "inline-flex items-center justify-center rounded-full border transition",
        dims,
        favorited
          ? "bg-metu-red/20 border-metu-red/60 text-metu-red hover:bg-metu-red/30"
          : "bg-surface-1/70 border-white/15 text-white/80 hover:text-metu-red hover:border-metu-red/50 backdrop-blur",
        busy && "opacity-70",
        className,
      )}
    >
      <Heart className={cn(iconDims, favorited && "fill-current")} strokeWidth={2} />
    </button>
  );
}
