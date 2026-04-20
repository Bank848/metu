import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import Link from "next/link";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-space-black disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap rounded-full",
  {
    variants: {
      variant: {
        primary: "bg-brand-yellow text-space-black hover:bg-brand-yellowDark shadow-pop",
        ghost:   "bg-white/10 text-white border border-line hover:bg-white/15",
        outline: "border border-line text-white hover:border-brand-yellow hover:bg-white/5",
        soft:    "bg-space-800 text-white hover:bg-space-700",
        dark:    "bg-space-900 text-white hover:bg-space-800 border border-line",
        danger:  "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2 text-sm",
        lg: "px-6 py-3 text-base",
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
