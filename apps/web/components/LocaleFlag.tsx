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
    // Union Jack -- simplified for icon size. White diagonals + red
    // diagonals on a navy field, plus the central white+red cross.
    return (
      <svg
        viewBox="0 0 60 30"
        className={`inline-block rounded-sm shadow-sm ${className}`}
        aria-hidden
      >
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFF" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2.5" clipPath="url(#uk-clip)" />
        <path d="M30,0 V30 M0,15 H60" stroke="#FFF" strokeWidth="10" />
        <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
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
