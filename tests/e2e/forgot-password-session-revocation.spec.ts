import { expect, test, type Page } from "@playwright/test";
import { loginViaUi, signUpViaApi } from "./helpers/auth";
import {
  getMailpitMessage,
  isMailpitAvailable,
  waitForMailpitMessage,
} from "./helpers/mailpit";

// Issue #68: better-auth does not revoke existing sessions after a password
// reset, so a stolen session stays valid after the password change. These
// tests pin the wanted behavior: after the reset form succeeds, every
// session the user held before the reset must be dead.
//
// The scenario uses two browser contexts:
//  - the "attacker" context logs in before the reset and keeps the session
//    cookie (this is the stolen session)
//  - the "owner" context requests the reset and applies the new password
//    through the emailed link
// After the reset, the attacker's context must be unauthenticated: the
// better-auth get-session API must answer null, and a protected route must
// bounce to /login.
//
// The email-dependent tests carry the @mailpit tag and auto-skip when
// Mailpit does not answer (mirrors forgot-password.spec.ts).
test.describe("forgot password revokes pre-reset sessions", () => {
  // A fresh user per run, so the mailbox for the address holds only the
  // emails this run produced and the reset token below is unambiguous.
  function uniqueUser() {
    const now = Date.now();
    return {
      name: "Session Revocation User",
      email: `session-revocation-${now}@example.test`,
      password: "session-revocation-old-1234",
      newPassword: "session-revocation-new-5678",
    };
  }

  // Same extraction rules as forgot-password.spec.ts: the reset email's link
  // points back to /forgot-password?token=... and the email is told apart
  // from the welcome and verification emails by its subject.
  const RESET_LINK_PATTERN =
    /(https?:\/\/[^\s"'<>]+forgot-password\?[^"'<>\s]+)/;

  /**
   * Submits the email request form on /forgot-password for `email` and waits
   * for the reset email in Mailpit, returning its reset link.
   */
  async function requestResetAndGetLink(
    page: Page,
    email: string,
  ): Promise<string | null> {
    await page.goto("/forgot-password");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByRole("button", { name: /send|reset/i }).click();

    const summary = await waitForMailpitMessage(email, (message) =>
      /password/i.test(message.Subject ?? ""),
    );
    expect(
      summary,
      `reset email to ${email} should appear in Mailpit`,
    ).toBeTruthy();
    const message = await getMailpitMessage(summary!.ID);
    if (!message) return null;
    const body = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
    return body.match(RESET_LINK_PATTERN)?.[1] ?? null;
  }

  /**
   * Applies the new password through the reset form on the emailed link and
   * waits for the success redirect to /login.
   */
  async function resetPasswordViaUi(
    page: Page,
    user: { newPassword: string },
    link: string,
  ) {
    await page.goto(link);
    await page
      .getByPlaceholder("Password", { exact: true })
      .fill(user.newPassword);
    await page
      .getByPlaceholder("Confirm Password", { exact: true })
      .fill(user.newPassword);
    await page.getByRole("button", { name: /reset/i }).click();
    await expect(page).toHaveURL(/\/login/);
  }

  /**
   * Full scenario setup: signs the user up, logs in from the attacker's
   * context (the pre-reset session), then resets the password from the
   * owner's context. Returns the attacker's page, which still holds the
   * pre-reset session cookie.
   */
  async function resetPasswordWithLivePreResetSession(
    browser: import("@playwright/test").Browser,
    user: ReturnType<typeof uniqueUser>,
  ): Promise<{ attackerPage: Page }> {
    await signUpViaApi(user);

    // The attacker logs in before the reset and keeps the session.
    const attackerContext = await browser.newContext();
    const attackerPage = await attackerContext.newPage();
    await loginViaUi(attackerPage, {
      email: user.email,
      password: user.password,
    });

    // The owner requests the reset and applies the new password.
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const link = await requestResetAndGetLink(ownerPage, user.email);
    expect(link, "the reset email should contain a reset link").toBeTruthy();
    await resetPasswordViaUi(ownerPage, user, link!);

    return { attackerPage };
  }

  test(
    "the get-session API answers null for a session issued before the reset",
    { tag: "@mailpit" },
    async ({ browser }) => {
      test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

      const user = uniqueUser();
      const { attackerPage } = await resetPasswordWithLivePreResetSession(
        browser,
        user,
      );

      // get-session must stop recognizing the pre-reset session. Playwright's
      // context-scoped request shares the context's cookies, so this call
      // carries the stolen session exactly as the attacker's browser would.
      const response = await attackerPage.context().request.get(
        "http://localhost:3100/api/auth/get-session",
        {
          headers: {
            // better-auth rejects null-origin requests; present the app's
            // own base URL (mirrors signUpViaApi).
            Origin: "http://localhost:3100",
          },
        },
      );
      expect(response.ok(), "get-session should answer 200").toBeTruthy();
      expect(await response.json()).toBeNull();
    },
  );

  test(
    "a browser holding the pre-reset session is logged out of protected routes",
    { tag: "@mailpit" },
    async ({ browser }) => {
      test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

      const user = uniqueUser();
      const { attackerPage } = await resetPasswordWithLivePreResetSession(
        browser,
        user,
      );

      // The pre-reset session must no longer pass the _authenticated
      // layout's beforeLoad: /dashboard bounces to /login.
      await attackerPage.goto("/dashboard");
      await expect(attackerPage).toHaveURL(/\/login/);
    },
  );
});
