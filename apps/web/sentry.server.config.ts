import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server init — runs inside the Node.js Next runtime.
 * Captures uncaught route-handler / server-component errors and any
 * explicit `Sentry.captureException()` from server code.
 *
 * Env-optional: same `SENTRY_DSN` pattern as the client config.
 * The server-side DSN can be a separate, server-only key if you want
 * to keep the public client DSN narrowly scoped — fall back to it.
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
