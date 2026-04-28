import { headers } from "next/headers";

/**
 * Phase 13.1 — BFF → API server fetch wrapper.
 *
 * Server Components in `app/**` call these helpers (or queries.ts
 * functions that delegate here) instead of importing Prisma. The
 * wrapper:
 *
 *   1. Picks the API base from `INTERNAL_API_URL` env (falls back to
 *      localhost:4000 for `npm run dev` parity).
 *   2. Forwards the inbound request's `cookie` header so the API
 *      server can resolve the session for routes that need
 *      `requireAuth()`. (Phase 13.1 catalog endpoints don't need it,
 *      but every future migration will — wire it once.)
 *   3. Throws `ApiError` (typed status + body) on non-2xx so callers
 *      can branch on `status`.
 *
 * Caching: defaults to `cache: "no-store"` because nearly every page
 * that consumes these helpers is `force-dynamic`. Callers that want
 * Next's data cache pass `next: { revalidate: N }` via `init`.
 */

const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API ${status}`);
    this.name = "ApiError";
  }
}

/**
 * `skipAuth: true` tells the wrapper NOT to read `headers()`. Required
 * when the caller is wrapped in Next's `unstable_cache(...)` — the
 * cache scope rejects every dynamic source, and `headers()` is one.
 * Public reference-data lookups (categories, tags, business-types,
 * countries) pass `skipAuth: true`. Anything that needs the session
 * cookie (basically every authed endpoint Phase 13.2+ will add)
 * leaves it false (the default).
 */
export interface ApiFetchInit extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const { skipAuth, ...fetchInit } = init;

  const cookie = skipAuth ? "" : headers().get("cookie") ?? "";

  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      ...(fetchInit.headers ?? {}),
      ...(cookie ? { cookie } : {}),
    },
    cache: fetchInit.cache ?? "no-store",
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON error body; leave as null
    }
    throw new ApiError(res.status, body);
  }
  // 204 No Content → return undefined
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Build a query-string from a plain object, dropping empty / null
 * / undefined values. Mirrors the URLSearchParams idiom but easier
 * to read at the call site.
 */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
