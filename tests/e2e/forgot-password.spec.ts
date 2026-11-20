import { expect, test } from "@playwright/test";
import { loginViaUi, signUpViaApi } from "./helpers/auth";
import {
  TOKEN_PATTERN,
  fillResetForm,
  requestResetAndGetLink,
} from "./helpers/forgot-password";
import { isMailpitAvailable } from "./helpers/mailpit";

// Issue #27: forgot password via an emailed reset link.
//
// Acceptance tests from the issue:
//  - a forgot-password page route with an input to enter the email address
//  - the login page's [Forgot password] link navigates to that page
//  - Mailpit receives an email whose link opens the forgot-password form
//  - after changing the password, the user can log in with the new password
//  - the password validation matches the sign-up page's form
//
// Route contract: one page at /forgot-password. Without a token it shows the
// email request form; opened with ?token=<signed token> it shows the new
// password form, so the emailed link lands on "the forgot password page
// (form)" as the issue words it.
//
// The email-dependent tests carry the @mailpit tag, so a run can exclude
// them with `playwright test --grep-invert @mailpit` (mirrors
// email-verification.spec.ts). They also auto-skip when Mailpit does not
// answer. The two pure-UI tests carry no tag, so they still run where
// Mailpit is absent.
test.describe("forgot password", () => {
  // A fresh user per run, so the mailbox for the address holds only the
  // emails this run produced and the reset token below is unambiguous.
  function uniqueUser() {
    const now = Date.now();
    return {
      name: "Forgot Password User",
      email: `forgot-password-${now}@example.test`,
      password: "forgot-password-old-1234",
      newPassword: "forgot-password-new-5678",
    };
  }

  test("shows an email input on the forgot-password page", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send|reset/i }),
    ).toBeVisible();
  });

  test("the login page's Forgot password link navigates to the forgot-password page", async ({
    page,
  }) => {
    await page.goto("/login");
    // In dev the module graph needs a moment before React attaches handlers;
    // networkidle covers both cold and warm loads (see loginViaUi).
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Forgot password" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });

  test(
    "sends an email with a reset link when the email form is submitted",
    { tag: "@mailpit" },
    async ({ page }) => {
      test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

      const user = uniqueUser();
      await signUpViaApi(user);

      const link = await requestResetAndGetLink(page, user.email);
      expect(
        link,
        "the reset email should contain a link back to the forgot-password page",
      ).toBeTruthy();
      expect(link).toMatch(/\/forgot-password\?/);
      expect(link).toMatch(TOKEN_PATTERN);
    },
  );

  test(
    "validates the new password like the sign-up form",
    { tag: "@mailpit" },
    async ({ page }) => {
      test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

      const user = uniqueUser();
      await signUpViaApi(user);

      const link = await requestResetAndGetLink(page, user.email);
      expect(link, "the reset email should contain a reset link").toBeTruthy();
      await page.goto(link!);

      // Same minimum-length rule and message text as the sign-up form
      // (src/routes/_auth/sign-up.tsx).
      await fillResetForm(page, "short", "short");
      await page.getByRole("button", { name: /reset/i }).click();
      await expect(
        page.getByText("Password must be atleast 8 characters"),
      ).toBeVisible();

      // Same mismatch rule and message text as the sign-up form.
      await fillResetForm(page, user.newPassword, "forgot-password-9999");
      await page.getByRole("button", { name: /reset/i }).click();
      await expect(page.getByText("Passwords do not match")).toBeVisible();
    },
  );

  test(
    "lets the user log in with the new password after resetting",
    { tag: "@mailpit" },
    async ({ page }) => {
      test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

      const user = uniqueUser();
      await signUpViaApi(user);

      const link = await requestResetAndGetLink(page, user.email);
      expect(link, "the reset email should contain a reset link").toBeTruthy();
      await page.goto(link!);

      await fillResetForm(page, user.newPassword, user.newPassword);
      await page.getByRole("button", { name: /reset/i }).click();

      // The old password must stop working: submitting it from the real
      // /login form must surface the login error, not a session.
      await page.context().clearCookies();
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await page.getByPlaceholder("Email").fill(user.email);
      await page.getByPlaceholder("Password").fill(user.password);
      await page
        .locator("form")
        .getByRole("button", { name: "Login", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Could not login user",
      );

      // ... and the new password must log the user in.
      await loginViaUi(page, { email: user.email, password: user.newPassword });
    },
  );
});
