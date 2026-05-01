import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiFetch, ApiError } from "./server/api";

// getMe calls GET /auth/me. apiFetch threads the request cookie.
// Returns null on 401; anything else propagates.
export async function getMe() {
  try {
    const data = await apiFetch<{
      user: any;
      role: "buyer" | "seller" | "admin";
      hasPassword?: boolean;
      requirePasswordReset?: boolean;
      totpEnabled?: boolean;
    }>("/auth/me");
    if (!data?.user) return null;
    return {
      user: data.user,
      role: data.role,
      hasPassword: data.hasPassword ?? true,
      requirePasswordReset: data.requirePasswordReset ?? false,
      totpEnabled: data.totpEnabled ?? false,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Bounce force-reset users to /profile/edit. Pages call this after
 * getMe(). Allows /profile/edit and the auth endpoints through.
 */
export function requireResetGuard(
  me: { requirePasswordReset?: boolean } | null,
  currentPath: string,
): void {
  if (!me?.requirePasswordReset) return;
  if (currentPath.startsWith("/profile/edit")) return;
  if (currentPath.startsWith("/login") || currentPath.startsWith("/logout")) return;
  redirect("/profile/edit?must-reset=1");
}

// Server-side fetch that forwards the user cookie. Returns null on
// 401/403/404 so callers can branch cleanly.
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
