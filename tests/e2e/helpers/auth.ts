import { expect, type Page } from "@playwright/test";
import { TEST_USER } from "../test-user";

/**
 * Logs in through the real /login form (better-auth email/password).
 *
 * Selectors come from src/routes/_auth/login.tsx: email/password inputs are
 * located by their placeholders and the submit button by its accessible name.
 */
export async function loginViaUi(
  page: Page,
  user: { email: string; password: string } = TEST_USER,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/login");
    // In dev the module graph needs a moment to load before React attaches
    // the submit handler; clicking too early falls back to a native GET
    // form submit (visible as a redirect to /login?). networkidle covers
    // both cold and warm loads.
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Email").fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);
    await page.getByRole("button", { name: "Login" }).click();
    // The login form redirects to /dashboard via better-auth's callbackURL.
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
      return;
    } catch {
      // Retry: either the form was not hydrated yet or navigation is slow.
    }
  }
  throw new Error(
    `loginViaUi: failed to reach /dashboard for ${user.email} after 3 attempts`,
  );
}

/**
 * Asserts that accessing a protected route while unauthenticated lands on
 * /login (the redirect comes from the _authenticated layout's beforeLoad).
 */
export async function expectRedirectedToLogin(page: Page, from: string) {
  await page.goto(from);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
}
