/**
 * Sentry client init — runs in the user's browser. Captures unhandled
 * promise rejections, render-time errors caught by error boundaries,
 * and any explicit `Sentry.captureException()` calls from app code.
 *
 * Lives at `instrumentation-client.ts` so it's compatible with the
 * Turbopack hot-path (Sentry v10 deprecated the old
 * `sentry.client.config.ts` filename).
 *
 * **Lazy-loaded.** The full Sentry browser SDK is ~70 kB gzipped and
 * we don't want to ship it on every route when no DSN is configured.
 * The dynamic `import()` makes Sentry an async chunk that the bundler
 * tree-shakes out of the main bundle entirely; nothing extra ships
 * unless `NEXT_PUBLIC_SENTRY_DSN` is set at build time AND a runtime
 * check passes.
 *
 *   fly secrets set NEXT_PUBLIC_SENTRY_DSN=https://…@sentry.io/… -a metu
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // Defer the SDK fetch a tick so it doesn't compete with hydration.
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      // Trace sample rate — keep 100 % during a demo so we have enough
      // data points; throttle to 20 % once production traffic shows up.
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
      // Capture every render error during dev for fast iteration; sample
      // session replays in prod to stay inside the free tier.
      replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
      replaysOnErrorSampleRate: 1.0,
      // Tag releases with the deploy SHA so we can attribute issues to
      // a commit. Falls back to "unknown" so the SDK doesn't refuse to start.
      release:
        process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
        process.env.FLY_GIT_COMMIT_SHA?.slice(0, 7) ??
        "unknown",
      environment: process.env.NODE_ENV ?? "development",
    });
  });
}
