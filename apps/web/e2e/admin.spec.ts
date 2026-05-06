import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Admin persona — logged-in platform operator.
 *
 * Happy path: log in → /admin dashboard loads → drill into stores
 * + tags. Both pages are layout-gated on me.role === "admin"; if
 * requireAuth's role lookup breaks we redirect to / and the URL
 * assertion fails.
 *
 * Non-destructive — read-only navigation only.
 */
test.describe("admin", () => {
  test("login → /admin → stores → tags", async ({ page }) => {
    await login(page, "admin");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\b/);
    await expect(page.locator("aside").first()).toBeVisible({
      timeout: 15_000,
    });

    // Stores listing — exercises the matview-backed top stores +
    // store table queries.
    await page.goto("/admin/stores");
    await expect(
      page.getByRole("heading", { name: /stores/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Tags analytics — uses the product_tag table (mapped from the
    // Tag Prisma model); a recent fix renamed the raw SQL FROM clause
    // to product_tag, so this guards against regression.
    await page.goto("/admin/tags");
    await expect(
      page.getByRole("heading", { name: /tags/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
