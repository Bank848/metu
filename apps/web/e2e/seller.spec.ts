import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Seller persona — logged-in store owner.
 *
 * Happy path: log in → /seller dashboard loads → at least one
 * seller-specific surface is reachable (Products list).
 *
 * Non-destructive — we only navigate, never mutate. A red here means
 * the seller dashboard or its data fetcher is broken.
 */
test.describe("seller", () => {
  test("login → seller dashboard → products list", async ({ page }) => {
    await login(page, "seller");

    // Sellers should land on the dashboard after login (or be one click
    // away via the "Dashboard" pill in TopNav). Visit directly to keep
    // the test independent of the post-login redirect logic.
    await page.goto("/seller");
    // The seller layout renders <SellerSidebar> + a page header; both
    // need a working `withStore` resolver.
    await expect(page.locator("aside, nav").first()).toBeVisible({
      timeout: 15_000,
    });

    // Drill into the products list and confirm at least the table
    // chrome renders. (Empty stores still show the "+ New product"
    // CTA, so we anchor on either the heading or that button.)
    await page.goto("/seller/products");
    await expect(
      page
        .getByRole("heading", { name: /products/i })
        .or(page.getByRole("link", { name: /new product/i }))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
