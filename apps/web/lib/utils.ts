import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True for base64 data URLs from seller uploads. Vercel's image optimiser
 * can't handle these, so we have to bypass it. Pass to `<Image unoptimized={…}>`.
 */
export const isDataUrl = (s: string | null | undefined): boolean =>
  typeof s === "string" && s.startsWith("data:");

/**
 * Resolve the absolute base URL.
 *  - On the browser: empty string → fetch hits the same origin.
 *  - On the server: derive from VERCEL_URL (auto-set by Vercel) or env override.
 */
function baseUrl(): string {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function apiUrl(path: string): string {
  const withApi = path.startsWith("/api/") ? path : "/api" + (path.startsWith("/") ? path : "/" + path);
  return `${baseUrl()}${withApi}`;
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
