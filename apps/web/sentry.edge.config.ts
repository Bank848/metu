import * as Sentry from "@sentry/nextjs";

/**
 * Sentry edge runtime init — used by Next middleware + any route
 * handler running on the edge. Same env-optional pattern.
 *
 * The edge runtime is a stripped-down V8 isolate (no Node APIs), so
 * the SDK uses its lightweight transport here. Sample rates match the
 * server config.
 */
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    release:
      process.env.SENTRY_RELEASE ??
      process.env.FLY_GIT_COMMIT_SHA?.slice(0, 7) ??
      "unknown",
    environment: process.env.NODE_ENV ?? "development",
  });
}
