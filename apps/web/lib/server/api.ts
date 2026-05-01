import { headers } from "next/headers";

// BFF -> API server fetch wrapper. Forwards the request's cookie header
// so authed endpoints work. Throws ApiError on non-2xx.

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
