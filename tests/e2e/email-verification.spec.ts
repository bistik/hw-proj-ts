import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./helpers/auth";
import { isEmailVerified } from "./helpers/db";
import {
  getMailpitMessage,
  isMailpitAvailable,
  waitForMailpitMessage,
} from "./helpers/mailpit";

// Issue #26: send an auth email verification. The local acceptance test is
// "mailpit should receive a verify-email-address email", and there must be a
// way to re-send the verification email.
//
// The tag lets CI (or any run) exclude this spec with
// `playwright test --grep-invert @mailpit` if Mailpit is unavailable there.
// In addition, the suite auto-skips whenever Mailpit does not answer, so a
// normal CI run needs no workflow change at all. This mirrors the
// course-invite-email.spec.ts pattern.
test.describe("email verification", { tag: "@mailpit" }, () => {
  // The E2E webServer runs on a dedicated port (see playwright.config.ts,
  // which lists the same constant).
  const BASE_URL = "http://localhost:3100";

  // A fresh user per run, so the mailbox for that address holds only the
  // emails this run produced and the tokens below are unambiguous.
  function uniqueUser() {
    const now = Date.now();
    return {
      name: "Verify Email User",
      email: `verify-email-${now}@example.test`,
      password: "verify-password-1234",
    };
  }

  // better-auth's verification email carries a link to its verify-email
  // endpoint with a signed token, rendered as the action button's href
  // (src/lib/email/templates/layout.ts) and repeated in the plain text body.
  const VERIFY_URL_PATTERN = /(https?:\/\/[^\s"'<>]+verify-email\?[^"'<>\s]+)/;
  const TOKEN_PATTERN = /verify-email\?token=([^&\s"'<>]+)/;

  /** Returns the verification link inside a Mailpit message, or null. */
  async function extractVerificationUrl(messageId: string): Promise<string | null> {
    const message = await getMailpitMessage(messageId);
    if (!message) return null;
    const body = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
    return body.match(VERIFY_URL_PATTERN)?.[1] ?? null;
  }

  test("sends a verification email when a user signs up", async () => {
    test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

    const user = uniqueUser();
    await signUpViaApi(user);

    // Mailpit should receive an email that asks the user to verify the
    // address. The welcome email ("Welcome to Lets do homework!") must not
    // match this predicate.
    const summary = await waitForMailpitMessage(user.email, (message) =>
      /verif/i.test(message.Subject ?? ""),
    );
    expect(
      summary,
      `verification email to ${user.email} should appear in Mailpit`,
    ).toBeTruthy();

    const message = await getMailpitMessage(summary!.ID);
    expect(message, `full Mailpit message ${summary!.ID}`).toBeTruthy();
    expect(message!.Subject).toMatch(/verif/i);

    // The email must carry the link the user follows to verify the address.
    const body = `${message!.HTML ?? ""}\n${message!.Text ?? ""}`;
    expect(body).toMatch(VERIFY_URL_PATTERN);
  });

  test("verifies the email address when the link in the email is followed", async ({
    page,
  }) => {
    test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

    const user = uniqueUser();
    await signUpViaApi(user);

    const summary = await waitForMailpitMessage(user.email, (message) =>
      /verif/i.test(message.Subject ?? ""),
    );
    expect(
      summary,
      `verification email to ${user.email} should appear in Mailpit`,
    ).toBeTruthy();

    const url = await extractVerificationUrl(summary!.ID);
    expect(
      url,
      "the verification email should contain a verification link",
    ).toBeTruthy();

    // Following the link must flip the user's email_verified flag, not just
    // answer with a success status.
    await page.goto(url!);
    await expect
      .poll(() => isEmailVerified(user.email), { timeout: 10_000 })
      .toBe(true);
  });

  test("re-sends the verification email when asked", async () => {
    test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

    const user = uniqueUser();
    await signUpViaApi(user);

    const first = await waitForMailpitMessage(user.email, (message) =>
      /verif/i.test(message.Subject ?? ""),
    );
    expect(first, "the initial verification email").toBeTruthy();
    const firstToken = (await extractVerificationUrl(first!.ID))?.match(
      TOKEN_PATTERN,
    )?.[1];
    expect(firstToken, "the first link carries a signed token").toBeTruthy();

    // The token is a JWT whose payload carries only the email and iat/exp at
    // second granularity, so two tokens issued within the same second are
    // byte-identical. Wait past the first token's issue second so the
    // re-send is guaranteed to produce a token that differs from the first.
    function decodeJwtPayload(token: string): { iat: number; exp: number } {
      return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    }
    const firstIat = decodeJwtPayload(firstToken!).iat;
    const waitMs = (firstIat + 1) * 1000 - Date.now() + 50;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Re-send: the app must expose a way to trigger a fresh verification
    // email for the address (better-auth's send-verification-email endpoint,
    // behind a UI affordance once one exists).
    const res = await fetch(`${BASE_URL}/api/auth/send-verification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // better-auth rejects null-origin requests (MISSING_OR_NULL_ORIGIN).
        Origin: BASE_URL,
      },
      body: JSON.stringify({ email: user.email, callbackURL: "/" }),
    });
    expect(
      res.ok,
      `the re-send request should succeed: ${res.status}`,
    ).toBe(true);

    // A new email must arrive, carrying a fresh token so an expired or used
    // first link cannot stand in for it.
    const second = await waitForMailpitMessage(user.email, (message) => {
      return message.ID !== first!.ID && /verif/i.test(message.Subject ?? "");
    });
    expect(
      second,
      `re-sent verification email to ${user.email} should appear in Mailpit`,
    ).toBeTruthy();
    const secondToken = (await extractVerificationUrl(second!.ID))?.match(
      TOKEN_PATTERN,
    )?.[1];
    expect(secondToken, "the re-sent link carries a signed token").toBeTruthy();
    expect(secondToken).not.toBe(firstToken);
  });
});
