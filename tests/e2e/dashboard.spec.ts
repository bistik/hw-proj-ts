import { expect, test } from "@playwright/test";
import { expectRedirectedToLogin, loginViaUi } from "./helpers/auth";

test.describe("dashboard", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    await expectRedirectedToLogin(page, "/dashboard");
  });

  test("greets the logged-in user and shows dashboard links", async ({
    page,
  }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Welcome back! E2E User/ }),
    ).toBeVisible();

    // Asserted by href rather than name: navbar.tsx also renders a "Courses"
    // link, so the accessible name alone would match multiple elements.
    await expect(page.locator('a[href="/student/courses"]')).toBeVisible();
    await expect(page.locator('a[href="/courses/new"]')).toBeVisible();
    await expect(page.locator('a[href="/lessons/new"]')).toBeVisible();
    await expect(page.locator('a[href="/assignments/new"]')).toBeVisible();
  });

  test("redirects away from /dashboard after logout", async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout lives behind the avatar dropdown menu (src/components/navbar.tsx).
    await page.getByRole("button", { name: "Navbar" }).click();
    await page.getByRole("link", { name: "Logout" }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});
