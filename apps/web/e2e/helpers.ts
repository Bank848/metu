import type { Page } from "@playwright/test";

/**
 * Shared seeded credentials — these match `packages/db/seed.ts` so
 * the smoke suite works against any freshly-seeded DB (including the
 * live demo on Fly).
 *
 * If the DB ever gets re-seeded with different emails, update here
 * (one place) rather than chasing strings across multiple spec files.
 */
export const ACCOUNTS = {
  buyer:  { email: "buyer@metu.dev",  password: "Buyer#123"  },
  seller: { email: "seller@metu.dev", password: "Seller#123" },
  admin:  { email: "admin@metu.dev",  password: "Admin#123"  },
} as const;

/**
 * Log in via the public /login form. Faster + more realistic than
 * mucking with cookies — exercises the same code path real users hit
 * (rate limiter, bcrypt verify, JWT issue).
 *
 * Returns once the cookie is set + we've navigated away from /login,
 * so the next call can immediately `goto()` an authed page.
 */
export async function login(
  page: Page,
  account: keyof typeof ACCOUNTS,
): Promise<void> {
  const creds = ACCOUNTS[account];
  await page.goto("/login");
  // Form labels aren't `for=`-associated to inputs in LoginForm.tsx, so
  // we target by `name=` which matches the FormData keys the route
  // handler reads. More resilient than text-based label matching.
  await page.locator('input[name="email"]').fill(creds.email);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.getByRole("button", { name: /log in|sign in/i }).first().click();
  // After a successful login the API redirects via JS; wait for the
  // cookie to settle and the URL to leave /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}
