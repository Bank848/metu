import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        yellow:  "bg-metu-yellow/20 text-metu-yellow border border-metu-yellow/35",
        gold:    "bg-gradient-to-b from-metu-yellow to-metu-gold text-surface-1 border-none shadow-gold",
        dark:    "bg-white/10 text-white border border-white/10",
        mist:    "bg-white/5 text-ink-secondary border border-white/8",
        // Phase 9 / Wave 2 — `success` + `info` consolidated onto mint so the
        // palette holds a single cool-accent register. Old `green-500` /
        // `blue-500` ad-hoc tints are retired (see docs/design-system.md §2.2).
        success: "bg-mint/15 text-mint border border-mint/30",
        info:    "bg-mint/15 text-mint border border-mint/30",
        // NEW — coral is the "hot" warm signal: promos, limited-time, trending.
        // Distinct from `metu-red` (destructive) and `metu-yellow` (primary).
        coral:   "bg-coral/15 text-coral border border-coral/35",
        warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
        danger:  "bg-metu-red/15 text-red-300 border border-metu-red/40",
        purple:  "bg-purple-500/15 text-purple-300 border border-purple-500/30",
      },
    },
    defaultVariants: {
      variant: "mist",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
