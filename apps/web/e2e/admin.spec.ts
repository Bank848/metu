import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Admin persona — logged-in platform operator.
 *
 * Happy path: log in → /admin dashboard loads → audit log + changelog
 * are reachable. These are the two pages most likely to break when
 * the schema changes (audit log queries the new AuditLog model) or
 * the layout changes (changelog uses the same admin layout gate).
 *
 * Non-destructive — read-only navigation only.
 */
test.describe("admin", () => {
  test("login → /admin → audit log → changelog", async ({ page }) => {
    await login(page, "admin");

    // /admin is gated on me.role === "admin" — if requireAuth's live
    // role lookup is broken we'll redirect to / and this assertion
    // will fail (URL doesn't match).
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\b/);
    // Sidebar is the canonical "we're inside the admin layout" check.
    await expect(page.locator("aside").first()).toBeVisible({
      timeout: 15_000,
    });

    // Audit log — driven by Batch D's AuditLog model + the new
    // /admin/audit page.
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", { name: /audit log/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Changelog — admin-only marketing page summarising the day's
    // batches. Lives behind the same layout gate as everything else.
    await page.goto("/admin/changelog");
    await expect(
      page.getByRole("heading", { name: /what.?s new/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
