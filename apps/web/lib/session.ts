import { cookies } from "next/headers";
import { apiFetch, ApiError } from "./server/api";

/**
 * Phase 13.2 — `getMe()` now calls `GET /auth/me` on the Express
 * server instead of reading the JWT cookie + loading from Prisma
 * directly. The cookie itself is forwarded by `apiFetch()` — it
 * reads `headers().get("cookie")` and threads it through.
 *
 * Return shape preserved 1:1 so consumer pages (`app/admin/layout.tsx`,
 * every server component that gates on role, etc.) keep working
 * unchanged. 401 from the API → caller sees `null` (logged-out
 * surface). Anything else propagates so genuine outages don't get
 * swallowed.
 */
export async function getMe() {
  try {
    const data = await apiFetch<{
      user: any;
      role: "buyer" | "seller" | "admin";
      // Phase 14.3 — present when the server resolved the user.
      // Older API responses (pre-14.3) won't include it; coerce
      // missing → true to keep the legacy change-password flow
      // as the safe default for existing users.
      hasPassword?: boolean;
    }>("/auth/me");
    if (!data?.user) return null;
    return {
      user: data.user,
      role: data.role,
      hasPassword: data.hasPassword ?? true,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Authenticated server-side fetch — forwards the user cookie when calling
 * an internal /api endpoint. Falls back gracefully on errors.
 *
 * NOTE: prefer importing from `lib/server/queries` for catalog reads where
 * possible — direct Prisma is faster and avoids URL-base detection. This
 * helper is kept for cart/orders/seller/admin endpoints that have richer
 * auth/business logic still living in the route handlers.
 */
export async function apiAuth<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const cookie = cookies().toString();
  const base = absoluteBase();
  const url = `${base}${path.startsWith("/api/") ? path : "/api" + (path.startsWith("/") ? path : "/" + path)}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function absoluteBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
