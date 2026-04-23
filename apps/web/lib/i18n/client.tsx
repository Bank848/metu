"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALES, MESSAGES, format, type Locale, type Messages } from "./messages";

/**
 * Client-side i18n context. Picks an initial locale from the cookie
 * (set by <LocaleSwitcher />) or falls back to "en", then exposes a
 * `t()` lookup for every consuming client component.
 *
 * Server components don't use this context — they read `getServerLocale()`
 * directly from cookies. Keeping the two paths symmetric means an English
 * server-rendered page hydrates into an English client tree without a
 * locale flicker on first paint.
 */

const STORAGE_KEY = "metu-locale";
const COOKIE_NAME = "metu_locale";

type Ctx = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: keyof Messages, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  const v = match?.[1];
  return (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : "en";
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "en");

  // Reconcile with the cookie on mount in case SSR fell through to a
  // different default than what the user picked previously.
  useEffect(() => {
    const fromCookie = readCookieLocale();
    if (fromCookie !== locale) setLocaleState(fromCookie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      // 1-year cookie so server components on the next request read the
      // same locale the client just selected.
      const oneYear = 60 * 60 * 24 * 365;
      document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${oneYear}; samesite=lax`;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode / disabled storage — non-fatal, cookie still set.
      }
      // Update <html lang> so screen readers + browsers know the active
      // language even before the server is reached again.
      document.documentElement.setAttribute("lang", next);
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = MESSAGES[locale];
    return {
      locale,
      setLocale,
      t: (key, vars) => {
        const template = dict[key as string] ?? MESSAGES.en[key as string] ?? (key as string);
        return format(template, vars);
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback: outside a provider (e.g. an isolated test render) we just
    // emit English without crashing. Real pages always wrap with the
    // root layout's <I18nProvider>.
    return {
      locale: "en",
      setLocale: () => {},
      t: (key, vars) => format(MESSAGES.en[key as string] ?? (key as string), vars),
    };
  }
  return ctx;
}
