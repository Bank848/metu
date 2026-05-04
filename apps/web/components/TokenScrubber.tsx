"use client";
import { useEffect } from "react";

/**
 * strips a query-string parameter from the address bar
 * (and browser history) once the page has consumed it.
 * Used on /verify-email and /reset-password where the token is only
 * needed once during initial render. After that there's no reason for
 * it to sit in `window.location` where it can leak via screen-share,
 * browser history sync, or referrer headers from any in-page link.
 * The replaceState call is harmless if the param is already absent.
 */
export function TokenScrubber({ param = "token" }: { param?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    const cleaned = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
    window.history.replaceState({}, "", cleaned);
  }, [param]);
  return null;
}
