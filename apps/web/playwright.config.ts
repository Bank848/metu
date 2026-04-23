import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the four-persona smoke suite.
 *
 * Defaults to the live Fly deploy (https://metu.fly.dev) so a CI run
 * doesn't need to spin up a local server. Override via `BASE_URL` to
 * point at a local dev server, a preview deploy, or a stage host:
 *
 *   BASE_URL=http://localhost:3000 npm run test:e2e -w @metu/web
 *
 * The suite is intentionally tiny — one happy-path walkthrough per
 * persona (guest, buyer, seller, admin) — so it runs in under a
 * minute and stays useful as a pre-deploy gate.
 */
export default defineConfig({
  testDir: "./e2e",
  // One file per persona; each test is self-contained so they can run
  // in parallel without bleeding state into each other.
  fullyParallel: true,
  // Fail-fast in CI to save minutes; locally we still want to see all
  // failures so we can fix them in one batch.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : [["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "https://metu.fly.dev",
    // Keep traces / screenshots only when a test fails — avoids the
    // multi-MB artefact dump after a green run.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Snappier than the default 30 s; a happy-path action shouldn't
    // need longer than this on a warm Neon compute.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
