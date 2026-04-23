"use client";
import { ChevronDown, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_NAMES, LOCALE_FLAGS } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Two-language picker for the TopNav. Sets the locale on the client
 * provider AND the cookie, then refreshes the route so server-rendered
 * strings reflect the new language too.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to dismiss — the dropdown is small enough that we don't
  // need an explicit close button.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(next: typeof locale) {
    setLocale(next);
    setOpen(false);
    // Refresh so server-rendered strings (TopNav, footer) re-render with
    // the new cookie. Cheap RSC payload swap, no full page reload.
    router.refresh();
  }

  return (
    <div ref={ref} className={cn("relative hidden md:inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
      >
        <Globe className="h-3.5 w-3.5 text-ink-secondary" />
        <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
        <span className="uppercase">{locale}</span>
        <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-line bg-space-900 shadow-2xl py-1 z-50"
        >
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => pick(l)}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition",
                    active
                      ? "bg-brand-yellow/15 text-brand-yellow font-semibold"
                      : "text-white hover:bg-white/5",
                  )}
                >
                  <span aria-hidden>{LOCALE_FLAGS[l]}</span>
                  <span>{LOCALE_NAMES[l]}</span>
                  {active && <span className="ml-auto text-[10px] uppercase">active</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

