import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@metu/shared", "@metu/db"],
  // Standalone output lets us ship a minimal runtime image to Fly.io —
  // Next copies only the production files into `.next/standalone/` and
  // we COPY that from the builder stage.
  output: "standalone",
  // Monorepo hint: include files from the repo root so workspace packages
  // (`@metu/shared`, `@metu/db`) land in the standalone bundle. In
  // Next 14.x this option lives under `experimental.` (it's promoted to
  // a top-level key starting Next 15).
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    // Required in Next < 15 for `instrumentation.ts` to be picked up —
    // Sentry depends on this hook to register the server runtime.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      // Google profile photos returned by OAuth — without this entry
      // next/image rejects the URL and the avatar falls back to its
      // initials placeholder.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
    ],
  },
  // Phase 22 — security headers on the BFF (what the browser actually
  // hits — the API behind metu-api.fly.dev sets its own headers via
  // helmet but the BFF wraps every page response).
  //
  // CSP allow-list is broader than the API because the BFF serves
  // <script>, <style>, <img>, <iframe> tags from real product pages:
  //   - Stripe.js + Stripe Connect onboarding iframes (js.stripe.com,
  //     connect.stripe.com, m.stripe.network)
  //   - Google avatars (lh3.googleusercontent.com) + Google Fonts
  //   - Unsplash / picsum / pravatar / dicebear demo images
  //   - 'unsafe-inline' style is required because Tailwind injects
  //     inline <style> tags during SSR. Same for fonts loaded via
  //     next/font which inlines the @font-face block.
  //   - 'unsafe-eval' script is required because Next.js dev mode
  //     uses eval for HMR ; production build doesn't need it but we
  //     keep it for now to avoid splitting prod / dev configs.
  async headers() {
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob:",
      // Phase 46 — Firebase Phone Auth needs:
      //   • script-src for Firebase JS SDK + reCAPTCHA challenge
      //   • connect-src for the identitytoolkit + securetoken endpoints
      //   • frame-src for the reCAPTCHA challenge iframe
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network https://www.gstatic.com https://www.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://metu-api.fly.dev https://api.stripe.com https://m.stripe.network https://accounts.google.com https://oauth2.googleapis.com https://*.sentry.io https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://connect.stripe.com https://www.google.com https://*.firebaseapp.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com https://connect.stripe.com",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

// withSentryConfig is a no-op when SENTRY_AUTH_TOKEN isn't set (it
// only enables source-map upload during build), so wrapping is safe
// in every environment.
export default withSentryConfig(nextConfig, {
  // Project / org are read from env when present — set them in Fly
  // secrets or .env.local to enable source-map upload:
  //   SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Quieter build logs unless we explicitly want noise.
  silent: !process.env.SENTRY_DEBUG,
  // Keep the bundle size unchanged — we don't need Sentry's tunnel
  // route for this demo.
  widenClientFileUpload: true,
});
