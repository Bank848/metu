import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve an API path. In development without NEXT_PUBLIC_API_URL set, falls back
 * to the local Express server on :4000 for backward compatibility. In production,
 * all calls go through /api/* handlers in this Next.js app (single-origin).
 */
export function apiUrl(path: string): string {
  const withApi = path.startsWith("/api/") ? path : "/api" + (path.startsWith("/") ? path : "/" + path);
  const external = process.env.NEXT_PUBLIC_API_URL;
  if (external && process.env.NODE_ENV !== "production") {
    // Dev override: let users point at an external Express server
    const legacy = path.startsWith("/api/") ? path.slice(4) : path.startsWith("/") ? path : "/" + path;
    return `${external}${legacy}`;
  }
  return withApi;
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
