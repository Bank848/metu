import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True for image sources that Vercel's image optimiser refuses to handle:
 *  - base64 data URLs from seller uploads
 *  - SVGs (Next blocks SVG optimisation by default for XSS reasons)
 *  - the DiceBear endpoint we use for seeded avatars (returns SVG without
 *    a .svg extension, so the URL pattern catch is needed)
 * Pass to `<Image unoptimized={…}>` so these still render as raw <img>.
 */
export const isDataUrl = (s: string | null | undefined): boolean => {
  if (typeof s !== "string") return false;
  if (s.startsWith("data:")) return true;
  if (s.includes("api.dicebear.com")) return true;
  if (/\.svg($|\?)/i.test(s)) return true;
  return false;
};

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
