import { expect, type Page } from "@playwright/test";
import { ensureEmailVerified } from "./db";
import { TEST_USER } from "../test-user";

// The E2E webServer runs on a dedicated port (see playwright.config.ts, which
// lists the same constant).
const BASE_URL = "http://localhost:3100";

/**
 * Signs a user up through the better-auth email API, which handles password
 * hashing; no SQL-side seeding is needed.
 *
 * Reruns must be idempotent: "User already exists" is fine, anything else is
 * a failure worth reporting.
 */
export async function ensureSignedUp(user: {
  name: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // better-auth rejects null-origin requests (MISSING_OR_NULL_ORIGIN);
      // present the app's own base URL, its only trusted origin.
      Origin: BASE_URL,
    },
    body: JSON.stringify(user),
  });

  const body = await res.json();
  if (!res.ok && !/exist/i.test(JSON.stringify(body))) {
    throw new Error(
      `[e2e] failed to seed test user ${user.email}: ${res.status} ${JSON.stringify(body)}`,
    );
  }

  // The courses layout requires verified emails and better-auth has no
  // verification email flow, so flip the flag in the e2e DB directly.
  await ensureEmailVerified(user.email);
}

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
    await expect(
      page.getByRole("button", { name: "Login with Google", exact: true }),
    ).toBeVisible();
    await page.getByPlaceholder("Email").fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Login", exact: true })
      .click();
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
  await expect(
    page.getByRole("button", { name: "Login with Google", exact: true }),
  ).toBeVisible();
}

/**
 * Logs out through the avatar dropdown menu (src/components/navbar.tsx),
 * whose trigger's accessible name comes from the avatar img's alt text,
 * and asserts the logout redirect to /login.
 */
export async function logoutViaUi(page: Page) {
  await page.getByRole("button", { name: "Navbar" }).click();
  await page.getByRole("link", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login/);
}
