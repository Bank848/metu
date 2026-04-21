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
        success: "bg-green-500/15 text-green-300 border border-green-500/30",
        warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
        danger:  "bg-metu-red/15 text-red-300 border border-metu-red/40",
        info:    "bg-blue-500/15 text-blue-300 border border-blue-500/30",
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
