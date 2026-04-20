import { cookies } from "next/headers";

/**
 * Server-side authenticated fetch. Uses the internal /api/* handlers by default.
 * In dev, if NEXT_PUBLIC_API_URL is set, routes to the external Express server.
 */
export async function apiAuth<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const cookie = cookies().toString();
  const external = process.env.NEXT_PUBLIC_API_URL;
  const isDevExternal = !!external && process.env.NODE_ENV !== "production";

  // Internal same-origin: build absolute URL from request context isn't available here,
  // so for SSR we hit the external API only when the env var is present,
  // otherwise we must use absolute origin via VERCEL_URL / NEXTAUTH_URL or fall back to
  // the /api path which Next.js serves internally.
  const base =
    isDevExternal
      ? external
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

  const url = isDevExternal
    ? `${base}${path}` // legacy Express — no /api prefix
    : `${base}${path.startsWith("/api/") ? path : "/api" + (path.startsWith("/") ? path : "/" + path)}`;

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

export async function getMe() {
  const data = await apiAuth<{ user: any; role: string }>("/auth/me");
  return data;
}
