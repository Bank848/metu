import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        yellow:  "bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/30",
        dark:    "bg-white/10 text-white border border-line",
        mist:    "bg-white/5 text-ink-secondary border border-line",
        success: "bg-green-500/15 text-green-300 border border-green-500/30",
        warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
        danger:  "bg-red-500/15 text-red-300 border border-red-500/30",
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
