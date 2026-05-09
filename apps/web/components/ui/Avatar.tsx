import Image from "next/image";
import { avatarHue, cn, getInitials, isDataUrl } from "@/lib/utils";

/**
 * Shared user-avatar primitive. When `profileImage` is null, renders
 * initials over a colour seeded deterministically from the username
 * (Gmail/Slack/GitHub convention) so the bubble is stable across pages.
 * Tiny by design: owns the visual + fallback only. Sizes use a token
 * so spacing reads consistently.
 */
type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 28,  // tight inline use (chips, mention popovers)
  sm: 36,  // table rows / topbar
  md: 48,  // contact cards / inbox lists
  lg: 64,  // PDP seller card
  xl: 96,  // /profile header
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-2xl",
};

export type AvatarProps = {
  /** Display name used to seed the initials and the hue. */
  name?: string | null;
  /** Email used as a fallback when `name` is empty (e.g. pre-onboarding). */
  email?: string | null;
  /** Optional uploaded photo. When present, replaces the initials bubble. */
  src?: string | null;
  size?: AvatarSize;
  /** Optional ring around the bubble. Used by the /profile header. */
  ring?: boolean;
  className?: string;
  /** Override the `<img alt>` — defaults to the resolved display name. */
  alt?: string;
};

export function Avatar({
  name,
  email,
  src,
  size = "sm",
  ring = false,
  className,
  alt,
}: AvatarProps) {
  const px = SIZE_PX[size];
  const initials = getInitials(name, email);
  const hue = avatarHue(name || email || "?");
  // HSL keeps the hue stable while we control saturation/lightness for
  // legibility. The ~85% lightness on the background pairs with a dark
  // 20% lightness foreground so initials hit AA contrast on every hue.
  const bg = `hsl(${hue} 70% 28%)`;
  const fg = `hsl(${hue} 70% 88%)`;
  const displayName = (name ?? "").trim() || (email ?? "").trim() || "User";

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-display font-bold tracking-tight select-none",
        SIZE_CLASSES[size],
        ring && "ring-4 ring-brand-yellow/20",
        className,
      )}
      // Inline style so we don't have to seed Tailwind's JIT with 360 hues.
      style={src ? undefined : { backgroundColor: bg, color: fg }}
      aria-label={src ? undefined : `${displayName} (no photo)`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt ?? displayName}
          fill
          sizes={`${px}px`}
          className="object-cover"
          unoptimized={isDataUrl(src)}
        />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  );
}
