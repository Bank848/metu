"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget — invisible-by-default, dark-themed
 * challenge that proves the form submitter is a human (or at least
 * not a trivial bot).
 *
 * The component lazy-loads Turnstile's `api.js`, mounts the widget into
 * a div ref, and hands the token back via `onVerify`. When the token
 * expires (~5 min) we reset to null so the parent form can re-prompt.
 *
 * Render this only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set —
 * otherwise the parent form skips both the widget and the server-side
 * verification entirely (handy for local dev).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type Props = {
  sitekey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

export function Turnstile({ sitekey, onVerify, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile) return;
    // Guard against React 18 strict-mode double-invocation in dev — only
    // mount the widget once per container instance.
    if (widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      theme: "dark",
      size: "flexible",
      callback: (token) => onVerify(token),
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onExpire?.(),
    });
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Cleanup races on hot-reload — safe to swallow.
        }
        widgetIdRef.current = null;
      }
    };
    // sitekey + callbacks shouldn't change once mounted; intentionally
    // sparse deps so we don't tear-down + remount on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, sitekey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />
      <div
        ref={containerRef}
        className="min-h-[65px] flex items-center justify-center"
        aria-label="CAPTCHA challenge"
      />
    </>
  );
}
