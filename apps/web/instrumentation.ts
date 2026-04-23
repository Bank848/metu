/**
 * Next.js 14 instrumentation hook — runs once per runtime when the
 * server boots. We use it to wire up Sentry on both the Node and edge
 * runtimes. The conditional require keeps the bundle for the *other*
 * runtime out of each entry point.
 *
 * This file MUST be at apps/web/instrumentation.ts (not in app/) and
 * MUST be enabled via experimental.instrumentationHook in next.config
 * for Next < 15. See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
