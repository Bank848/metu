import { test, expect } from "@playwright/test";

/**
 * Guest persona — anyone visiting METU without an account.
 *
 * Happy path: home page renders → browse → at least one product card
 * is clickable → product detail page loads.
 *
 * No auth, no DB writes — this run is non-destructive and safe to
 * point at production. Failure here is the loudest possible alarm:
 * the public marketplace is broken.
 */
test.describe("guest", () => {
  test("home → browse → product detail", async ({ page }) => {
    await page.goto("/");
    // The TopNav logo + tagline are the canonical "the page rendered"
    // assertion. Any of these missing means React didn't hydrate.
    await expect(page).toHaveTitle(/METU/);
    await expect(page.locator("header").first()).toBeVisible();

    // Walk into the marketplace via the nav's category pill.
    await page.goto("/browse");
    await expect(page.getByRole("heading", { name: /Browse|Results/i }).first()).toBeVisible();

    // Wait for at least one product card link to attach. Cards are
    // anchor tags pointing at /product/[id].
    const firstProduct = page.locator('a[href^="/product/"]').first();
    await firstProduct.waitFor({ state: "attached", timeout: 15_000 });

    // Click into the product. After navigation we expect to land on
    // /product/<digits> and see the AddToCart variant picker (rendered
    // only when there's at least one ProductItem variant).
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\/\d+/);
    await expect(page.locator("body")).toContainText(/Add to cart|Buy now/i);
  });
});
