import { cookies } from "next/headers";
import { LOCALES, MESSAGES, format, type Locale, type Messages } from "./messages";

const COOKIE_NAME = "metu_locale";

/**
 * Read the active locale from the request cookie. Server components call
 * this directly so the SSR markup matches what the client provider will
 * pick up on hydration — no locale flicker on first paint.
 */
export function getServerLocale(): Locale {
  const v = cookies().get(COOKIE_NAME)?.value;
  return (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : "en";
}

/** Translate a key on the server. Mirror of `t` in the client provider. */
export function getServerT(): (key: keyof Messages, vars?: Record<string, string | number>) => string {
  const locale = getServerLocale();
  const dict = MESSAGES[locale];
  return (key, vars) => {
    const template = dict[key as string] ?? MESSAGES.en[key as string] ?? (key as string);
    return format(template, vars);
  };
}
