/**
 * Inline SVG flag icons for the language picker.
 *
 * Windows browsers don't bundle the flag emoji glyphs (🇬🇧 / 🇹🇭),
 * so the UI was falling back to the underlying country-code text
 * pair "GB" / "TH" -- ugly + cryptic to users. These SVGs render
 * the same on every platform.
 */
type Locale = "en" | "th";

export function LocaleFlag({
  locale,
  className = "",
}: {
  locale: Locale;
  className?: string;
}) {
  if (locale === "en") {
    // Stars and Stripes -- 13 stripes (7 red, 6 white) + blue canton.
    // Stars simplified to a 3x3 dot grid for icon-size legibility.
    return (
      <svg
        viewBox="0 0 19 10"
        className={`inline-block rounded-sm shadow-sm ${className}`}
        aria-hidden
      >
        <rect width="19" height="10" fill="#B22234" />
        <g fill="#FFFFFF">
          <rect y="0.77" width="19" height="0.77" />
          <rect y="2.31" width="19" height="0.77" />
          <rect y="3.85" width="19" height="0.77" />
          <rect y="5.38" width="19" height="0.77" />
          <rect y="6.92" width="19" height="0.77" />
          <rect y="8.46" width="19" height="0.77" />
        </g>
        <rect width="7.6" height="5.38" fill="#3C3B6E" />
        <g fill="#FFFFFF">
          <circle cx="1.5" cy="1.2" r="0.35" />
          <circle cx="3.0" cy="1.2" r="0.35" />
          <circle cx="4.5" cy="1.2" r="0.35" />
          <circle cx="6.0" cy="1.2" r="0.35" />
          <circle cx="2.25" cy="2.4" r="0.35" />
          <circle cx="3.75" cy="2.4" r="0.35" />
          <circle cx="5.25" cy="2.4" r="0.35" />
          <circle cx="1.5" cy="3.6" r="0.35" />
          <circle cx="3.0" cy="3.6" r="0.35" />
          <circle cx="4.5" cy="3.6" r="0.35" />
          <circle cx="6.0" cy="3.6" r="0.35" />
          <circle cx="2.25" cy="4.8" r="0.35" />
          <circle cx="3.75" cy="4.8" r="0.35" />
          <circle cx="5.25" cy="4.8" r="0.35" />
        </g>
      </svg>
    );
  }
  // Thailand -- five horizontal stripes (red, white, blue, white, red).
  // Stripe ratio per the official spec is 1:1:2:1:1 = total 6 ; we render
  // at 30x20 so each "1" unit = 4px / "2" = 8px.
  return (
    <svg
      viewBox="0 0 30 20"
      className={`inline-block rounded-sm shadow-sm ${className}`}
      aria-hidden
    >
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.33" width="30" height="13.33" fill="#F4F5F8" />
      <rect y="6.67" width="30" height="6.67" fill="#2D2A4A" />
    </svg>
  );
}
