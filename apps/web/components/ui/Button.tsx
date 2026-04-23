import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import Link from "next/link";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-metu-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap rounded-pill",
  {
    variants: {
      variant: {
        primary: "button-gradient text-surface-1",
        gold:    "button-gradient text-surface-1",
        glass:   "glass-morphism text-white hover:bg-white/10",
        ghost:   "bg-white/5 text-white border border-white/10 hover:bg-white/10",
        outline: "border border-white/15 text-white hover:border-metu-yellow/60 hover:bg-white/5",
        soft:    "bg-surface-3 text-white hover:bg-surface-4",
        dark:    "bg-surface-2 text-white border border-white/8 hover:bg-surface-3",
        danger:  "bg-metu-red/15 text-red-200 border border-metu-red/40 hover:bg-metu-red/25",
        // Phase 9 / Wave 2 — non-primary CTAs that want to read "fresh /
        // positive" or "hot / promotional" without leaning on gold. The
        // hover state warms the tint slightly without touching `metu-yellow`.
        mint:    "bg-mint/15 text-mint border border-mint/30 hover:bg-mint/25",
        coral:   "bg-coral/15 text-coral border border-coral/35 hover:bg-coral/25",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2 text-sm",
        lg: "px-7 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, href, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);
    if (href) {
      return (
        <Link href={href} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
