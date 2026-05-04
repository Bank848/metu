// Centralised env reads — single place to change when domain/keys move.

export const SITE_URL: string = process.env.SITE_URL ?? "https://metu.online";

export const PUBLIC_SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL;

export const stripeIsConfigured = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY);

export const TURNSTILE_SECRET: string | undefined = process.env.TURNSTILE_SECRET;

// Demo mode leaks raw OTP + email-verify tokens in the response so the
// verify pages can render them without real SMS / non-owner Resend.
// Must be false in prod.
export const DEMO_REVEAL_TOKENS: boolean =
  process.env.DEMO_REVEAL_TOKENS === "true";
