import { headers } from "next/headers";
import { Agent, setGlobalDispatcher } from "undici";
import { INTERNAL_API_URL } from "../config";

// BFF -> API server fetch wrapper. Forwards the request's cookie header
// so authed endpoints work. Throws ApiError on non-2xx.

const API_BASE = INTERNAL_API_URL;

// Connection pooling. Without this, every apiFetch() call opens a
// fresh TCP+TLS connection to the API host — 100-300ms of pure
// handshake overhead PER CALL. The homepage fires ~7 calls per
// SSR; that's up to ~2 seconds of avoidable handshake latency.
//
// undici's Agent keeps connections open across requests within the
// Node process. setGlobalDispatcher hooks fetch's transport so this
// applies to every fetch() call, not just direct dispatch.
//
// Module-level singleton — runs once at first import inside the
// Next.js BFF process; does nothing in the browser.
if (typeof window === "undefined" && !(globalThis as { __metuFetchAgent?: Agent }).__metuFetchAgent) {
  const agent = new Agent({
    keepAliveTimeout: 30_000,        // hold connections 30s after last use
    keepAliveMaxTimeout: 600_000,    // hard upper bound 10 min
    connections: 32,                 // up to 32 concurrent per origin
  });
  setGlobalDispatcher(agent);
  (globalThis as { __metuFetchAgent?: Agent }).__metuFetchAgent = agent;
}

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

// `skipAuth: true` skips headers() so the call is safe inside
// unstable_cache (which rejects dynamic sources). Public reads pass it.
export interface ApiFetchInit extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const { skipAuth, ...fetchInit } = init;

  const inboundHeaders = skipAuth ? null : headers();
  const cookie = inboundHeaders?.get("cookie") ?? "";
  // Forward client IP markers so the upstream API records the real
  // visitor's IP in audit rows + rate-limit buckets. Without this, the
  // BFF machine's IP appears for every server-rendered admin/seller
  // action because Express only sees BFF -> API on the upstream call.
  const flyIp = inboundHeaders?.get("fly-client-ip") ?? "";
  const xff = inboundHeaders?.get("x-forwarded-for") ?? "";

  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      ...(fetchInit.headers ?? {}),
      ...(cookie ? { cookie } : {}),
      ...(flyIp ? { "fly-client-ip": flyIp } : {}),
      ...(xff ? { "x-forwarded-for": xff } : {}),
    },
    cache: fetchInit.cache ?? "no-store",
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Build a query-string, dropping empty/null/undefined values.
export function qs(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
