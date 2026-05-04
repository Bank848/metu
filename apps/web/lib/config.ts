// Centralised env reads. NEXT_PUBLIC_* values are inlined at build
// time so they're safe to import from client components.

export const INTERNAL_API_URL: string =
  process.env.INTERNAL_API_URL ?? "http://localhost:4000";

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://metu.online";

export const TURNSTILE_SITE_KEY: string | undefined =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const STRIPE_PUBLISHABLE_KEY: string | undefined =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
