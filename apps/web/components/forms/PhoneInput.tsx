"use client";
import { useId, useMemo } from "react";

/**
 * Phase 42 — phone input with a small country-code picker.
 *
 * The component owns the dial-code dropdown and the digit field. Its
 * `value` is always the canonical E.164 string (e.g. `+66812345678`)
 * so callers can drop it straight into a JSON payload without parsing.
 *
 * Thai users sometimes type a leading 0 out of habit — when the
 * selected country is Thailand we strip a single leading 0 before
 * concatenating with `+66`. Other dial codes are left as-is.
 *
 * The country list is intentionally short. We picked the common ASEAN
 * markets plus a handful of global ones the demo audience cares about.
 * Each option has an inline SVG flag so the dropdown looks the same
 * on every OS (Windows in particular doesn't ship colour emoji flags).
 */

type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // including leading +
};

export const PHONE_COUNTRIES: Country[] = [
  { code: "TH", name: "Thailand",     dial: "+66" },
  { code: "SG", name: "Singapore",    dial: "+65" },
  { code: "MY", name: "Malaysia",     dial: "+60" },
  { code: "ID", name: "Indonesia",    dial: "+62" },
  { code: "PH", name: "Philippines",  dial: "+63" },
  { code: "VN", name: "Vietnam",      dial: "+84" },
  { code: "JP", name: "Japan",        dial: "+81" },
  { code: "KR", name: "South Korea",  dial: "+82" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
];

/**
 * Splits a stored phone string back into a dial code + digit body so
 * the input can mount in edit mode without re-prompting the user.
 */
export function splitPhone(stored: string | null | undefined): {
  countryCode: string;
  digits: string;
} {
  const safe = (stored ?? "").trim();
  if (!safe) return { countryCode: "TH", digits: "" };
  // Best match wins on dial-code prefix; tie-broken by length descending
  // so "+1" doesn't claim "+1234..." that should belong to "+12".
  const ordered = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dial.length - a.dial.length,
  );
  for (const c of ordered) {
    if (safe.startsWith(c.dial)) {
      return { countryCode: c.code, digits: safe.slice(c.dial.length) };
    }
  }
  return { countryCode: "TH", digits: safe.replace(/^\+/, "") };
}

export function joinPhone(countryCode: string, digits: string): string {
  const country = PHONE_COUNTRIES.find((c) => c.code === countryCode) ?? PHONE_COUNTRIES[0];
  let body = digits.replace(/\D/g, "");
  // Common Thai habit — typing 0812345678 instead of 812345678. The
  // leading 0 is a domestic-trunk prefix and should be stripped before
  // we prepend +66.
  if (country.code === "TH" && body.startsWith("0")) {
    body = body.replace(/^0+/, "");
  }
  return body ? `${country.dial}${body}` : "";
}

export function PhoneInput({
  countryCode,
  digits,
  onCountryChange,
  onDigitsChange,
  required,
  autoComplete = "tel",
  className,
  digitsClassName,
  selectClassName,
  id,
}: {
  countryCode: string;
  digits: string;
  onCountryChange: (code: string) => void;
  onDigitsChange: (digits: string) => void;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  digitsClassName?: string;
  selectClassName?: string;
  id?: string;
}) {
  const fallbackId = useId();
  const inputId = id ?? `phone-${fallbackId}`;
  const country = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.code === countryCode) ?? PHONE_COUNTRIES[0],
    [countryCode],
  );
  return (
    <div className={`flex w-full gap-2 ${className ?? ""}`}>
      <select
        aria-label="Country code"
        value={country.code}
        onChange={(e) => onCountryChange(e.target.value)}
        className={
          selectClassName ??
          "rounded-xl border border-line bg-space-900 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-yellow"
        }
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {flagEmoji(c.code)} {c.dial} {c.name}
          </option>
        ))}
      </select>
      <input
        id={inputId}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        required={required}
        placeholder={country.code === "TH" ? "0812345678" : "812345678"}
        value={digits}
        onChange={(e) => onDigitsChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
        className={
          digitsClassName ??
          "flex-1 rounded-xl border border-line bg-space-900 px-4 py-2.5 text-white outline-none focus:border-brand-yellow"
        }
      />
    </div>
  );
}

// Inline flag glyphs would balloon the bundle. Most browsers render
// the regional-indicator pair as a flag; on Windows they fall back to
// the ISO letters which still reads. Good enough for the dropdown.
function flagEmoji(code: string): string {
  const A = 0x1f1e6;
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65))
    .join("");
}
