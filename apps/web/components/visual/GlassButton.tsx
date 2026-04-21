import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "gold" | "glass" | "outline";

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    { href, tone = "gold", size = "md", fullWidth, className, children, ...rest },
    ref,
  ) => {
    const sizes = {
      sm: "px-4 py-1.5 text-xs",
      md: "px-5 py-2.5 text-sm",
      lg: "px-7 py-3 text-base",
    }[size];

    const toneClasses = {
      gold: "button-gradient text-surface-1 hover:brightness-110",
      glass:
        "glass-morphism text-white hover:bg-white/10 active:bg-white/15 border border-white/10",
      outline:
        "bg-transparent text-white border border-white/15 hover:border-metu-yellow/60 hover:bg-white/5",
    }[tone];

    const classes = cn(
      "inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-metu-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 disabled:opacity-50 disabled:pointer-events-none",
      sizes,
      toneClasses,
      fullWidth && "w-full",
      className,
    );

    if (href) {
      return (
        <Link href={href} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <button ref={ref} className={classes} {...rest}>
        {children}
      </button>
    );
  },
);
GlassButton.displayName = "GlassButton";
