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
    // Cold-cache buster: self-warm the unstable_cache slots on boot
    // and keep them warm so the first real visitor never pays the
    // cold-miss tax. Each Fly machine runs its own copy and warms
    // its local cache independently. Public pages only — auth-gated
    // surfaces would need a service token we don't issue today.
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
  // Keep this list small + covering — too many entries multiplies the
  // load with little extra hit-rate gain on a single-region deploy.
  const HOT_URLS = ["/", "/browse", "/product/1", "/store/1"];
  // unstable_cache values for these surfaces have a 60s TTL. A warmup
  // that fires while the cache is still valid is a no-op (returns the
  // cached value without re-running the fetch). Firing more often
  // catches the moment of expiry quickly and absorbs the refresh cost
  // ourselves so real visitors keep landing on warm slots. 20s gives
  // ~3 hits per TTL window, ~12 self-requests/min — negligible load.
  const KEEP_WARM_INTERVAL_MS = 20_000;
  // Wait long enough for app/server to finish booting + Postgres
  // connections to handshake before firing the first request. Too
  // early and the loopback fails / pollutes Sentry with noise.
  const BOOT_GRACE_MS = 10_000;

  // Sequential not parallel — on shared-cpu-1x, four concurrent
  // server-component renders on the same machine spike CPU enough to
  // delay any real visitor that lands during the warmup window.
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
    console.log(`[warmup] ${ok}/${HOT_URLS.length} ok, ${fail} fail, ${Date.now() - t0}ms`);
  }

  setTimeout(() => {
    void warm();
    setInterval(() => void warm(), KEEP_WARM_INTERVAL_MS);
  }, BOOT_GRACE_MS);
}
