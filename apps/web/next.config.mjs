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
    ],
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
