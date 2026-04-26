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
 * Downsize Unsplash gallery images for product-card thumbnails.
 *
 * Hero / detail pages use the 1200×800 variant; cards on /browse and
 * the favourites grid only need ~600×400. Replacing the size suffix
 * in the URL keeps Unsplash from serving us multi-MB images that the
 * browser then has to decode + downscale into ~200 px thumbnails.
 *
 * Pure URL transform, no I/O — extracted from `ProductCard` so it can
 * be reused by RelatedProducts, the Compare grid, etc.
 */
export function cardImage(url: string): string {
  if (!url) return url;
  if (!url.includes("images.unsplash.com")) return url;
  return url.replace("w=1200", "w=600").replace("h=800", "h=400");
}

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

/**
 * Two-letter initials for an avatar fallback. Strips emoji/punctuation,
 * collapses whitespace, then picks first letter of the first two words —
 * mirroring the convention used by Gmail / Slack / GitHub avatars so the
 * empty-state visually reads as "this is a person" rather than a blob of
 * yellow.
 *
 *   getInitials("Mei Huang")           // "MH"
 *   getInitials("Kanda Chitra extra")  // "KC"  (extra word ignored)
 *   getInitials("madonna")             // "M"
 *   getInitials(undefined, "u@x.dev")  // "U"   (email fallback)
 *   getInitials("", "")                // "?"   (last-ditch fallback so the
 *                                              //   bubble is never empty)
 */
export function getInitials(name: string | null | undefined, fallback?: string | null): string {
  const raw = (name ?? "").trim() || (fallback ?? "").trim();
  if (!raw) return "?";
  // For email-shaped fallbacks ("alice@example.dev") only the local
  // part should contribute — otherwise the domain leaks into the
  // initials (e.g. "u@example.dev" → "UE"). Names that happen to
  // contain "@" are rare enough that this trade-off is fine.
  const source = raw.includes("@") ? raw.split("@")[0] : raw;
  // Drop characters that aren't letters/numbers in any script (covers
  // emoji + most punctuation while still respecting Thai / accented chars).
  const cleaned = source.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(" ").slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

/**
 * Deterministic hue (0..359) seeded from a string — same input always
 * yields the same hue. Used by the avatar fallback so a given user's
 * "blank" bubble is consistent across pages instead of flashing a new
 * colour on each render. Cheap FNV-ish hash over code points; not
 * cryptographic, just stable.
 */
export function avatarHue(seed: string | null | undefined): number {
  const s = (seed ?? "").trim() || "?";
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
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
