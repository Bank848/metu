import { cn } from "@/lib/utils";

// Seller level pill — colours scale with the level so a glance tells
// you whether the shop is a fresh listing (L1, grey) or a power seller
// (L5, gold). Levels come from v_user_level (recomputed at read time
// from settled-order count + rating + revenue, see
// 20260511180000_add_user_level_view).
const TONE: Record<number, string> = {
  1: "bg-white/8 text-ink-secondary border-white/15",
  2: "bg-info/15 text-info border-info/35",
  3: "bg-mint/15 text-mint border-mint/35",
  4: "bg-purple-500/15 text-purple-300 border-purple-500/40",
  5: "bg-metu-yellow/20 text-metu-yellow border-metu-yellow/45",
};

type Size = "xs" | "sm";

export function SellerLevelBadge({
  level,
  size = "xs",
  className,
}: {
  level: number | null | undefined;
  size?: Size;
  className?: string;
}) {
  if (level == null || level < 1) return null;
  const lv = Math.max(1, Math.min(5, level));
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-black uppercase tracking-wider border shrink-0 tabular-nums",
        size === "xs" ? "px-1.5 py-[1px] text-[9px] leading-none" : "px-2 py-0.5 text-[10px]",
        TONE[lv],
        className,
      )}
      title={`Seller level ${lv} of 5`}
    >
      Lv.{lv}
    </span>
  );
}
