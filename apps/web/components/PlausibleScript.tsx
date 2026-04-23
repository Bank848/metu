import Script from "next/script";

/**
 * Plausible analytics — privacy-first, cookie-free, GDPR-compliant by
 * default so we don't owe anyone a consent banner.
 *
 * Opt-in via env: when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set we mount
 * the tracking script. Without it we render nothing — local dev and
 * preview deploys stay analytics-free.
 *
 * Usage of `next/script` with afterInteractive defers the request
 * until the page is interactive so it doesn't compete with hydration.
 */
export function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  // Self-hosted Plausible is supported by overriding the host. Default
  // is the SaaS endpoint — the only one that matters for the demo.
  const host = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";

  return (
    <Script
      src={`${host}/js/script.js`}
      data-domain={domain}
      strategy="afterInteractive"
      defer
    />
  );
}
