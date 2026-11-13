import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";

/**
 * Issue #15: the homepage must not have a counter. Instead it should:
 * - redirect logged-in users to /dashboard
 * - show guests a welcome message plus a link to signup and one to login
 *
 * TDD: written before any implementation change to src/routes/index.tsx.
 * A fresh Playwright page holds no session cookies, so a plain page.goto("/")
 * exercises the guest path; loginViaUi exercises the logged-in path.
 */
test.describe("homepage", () => {
  test("does not show a counter", async ({ page }) => {
    await page.goto("/");

    // The old homepage's only element was the "Add 1 to N?" counter button;
    // assert it by name so any re-introduced counter fails the test.
    await expect(page.getByRole("button", { name: /Add 1 to/ })).toHaveCount(0);
  });

  test("redirects a logged-in user to /dashboard", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/");

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("shows guests a welcome message with signup and login links", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /welcome/i }),
    ).toBeVisible();
    // Asserted by href: the accessible names of these links are an
    // implementation detail until the route lands.
    await expect(page.locator('a[href="/sign-up"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });
});
