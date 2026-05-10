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
    // Boot-only warmup — fires once after the server is ready so the
    // cache is hot for the first real visitor after a deploy. The
    // earlier periodic loop was dropped: shared-cpu-1x couldn't
    // absorb a self-fetch every 20s without inflating real-visitor
    // TTFB by ~0.7-1s. Real demo traffic keeps the cache warm; idle
    // periods accept a single cold-miss every 60s, which is fine.
    if (process.env.NODE_ENV === "production") {
      scheduleSelfWarmup();
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

function scheduleSelfWarmup() {
  const PORT = process.env.PORT ?? "8080";
  const BASE = `http://127.0.0.1:${PORT}`;
  // Public read paths whose data layer is wrapped in unstable_cache.
  // Keep the list small + covering: each request renders a full page
  // server-side, and on shared-cpu-1x even sequential fetches add CPU
  // pressure that real visitors then queue behind.
  const HOT_URLS = ["/", "/browse", "/product/1", "/store/1"];
  // Wait long enough for the Next server + Prisma + Sentry to finish
  // booting before firing the loopback fetches. Too early and they
  // race the listener / fail with ECONNREFUSED.
  const BOOT_GRACE_MS = 10_000;

  // Sequential, fire-and-forget. Errors swallowed — if a URL is
  // mistyped or temporarily 500s, just log it and move on; the next
  // boot will retry.
  async function warm() {
    const t0 = Date.now();
    let ok = 0;
    let fail = 0;
    for (const u of HOT_URLS) {
      try {
        const res = await fetch(BASE + u, {
          cache: "no-store",
          headers: { "x-warmup": "1", "user-agent": "metu-warmup/1.0" },
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[warmup] boot ${ok}/${HOT_URLS.length} ok, ${fail} fail, ${Date.now() - t0}ms`);
  }

  setTimeout(() => void warm(), BOOT_GRACE_MS);
}
