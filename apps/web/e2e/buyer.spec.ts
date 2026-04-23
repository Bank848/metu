import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Buyer persona — logged-in shopper.
 *
 * Happy path: log in → /browse → click first product → "Add to cart"
 * → /cart shows the item.
 *
 * **Mutates live data**: adds an item to the buyer's cart on the
 * target environment. Leaves the cart non-empty for the next run; we
 * accept the dirty state because the demo seed buyer is shared
 * across smoke runs anyway.
 */
test.describe("buyer", () => {
  test("login → browse → add to cart → cart shows item", async ({ page }) => {
    await login(page, "buyer");

    // Land on /browse and click into the first product.
    await page.goto("/browse");
    const firstProduct = page.locator('a[href^="/product/"]').first();
    await firstProduct.waitFor({ state: "attached", timeout: 15_000 });
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\/\d+/);

    // The first variant is auto-selected by AddToCart, so we can hit
    // "Add to cart" immediately. Use a regex anchor to dodge the
    // post-add "Added" label flicker.
    const addButton = page.getByRole("button", { name: /^add to cart$/i }).first();
    await addButton.click();

    // The success toast renders inline ("Added to cart ✓"). Check for
    // either it or the cart icon's count badge changing — whichever
    // arrives first.
    await expect(page.getByText(/added to cart/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Now visit /cart and confirm at least one line is rendered.
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /cart/i }).first()).toBeVisible();
    // Cart subtotal label appears only when there's at least one item.
    await expect(page.getByText(/subtotal/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
