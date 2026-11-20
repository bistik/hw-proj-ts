import { expect, type Page } from "@playwright/test";
import { getMailpitMessage, waitForMailpitMessage } from "./mailpit";

// Shared forgot-password helpers. The reset-email extraction rules and the
// form selectors live here, so a change to the email format or the form
// labels needs an update in one place only (see forgot-password.spec.ts and
// forgot-password-session-revocation.spec.ts).

// better-auth's reset email carries a signed link back to the
// forgot-password page, rendered as the action button's href
// (src/lib/email/templates/layout.ts) and repeated in the plain text body.
export const RESET_LINK_PATTERN =
  /(https?:\/\/[^\s"'<>]+forgot-password\?[^"'<>\s]+)/;
export const TOKEN_PATTERN = /[?&]token=([^&\s"'<>]+)/;

/** Returns the reset link inside a Mailpit message, or null. */
async function extractResetLink(messageId: string): Promise<string | null> {
  const message = await getMailpitMessage(messageId);
  if (!message) return null;
  const body = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
  return body.match(RESET_LINK_PATTERN)?.[1] ?? null;
}

/**
 * Submits the email request form on /forgot-password for `email` and waits
 * for the reset email in Mailpit, returning its reset link.
 *
 * Selectors the forgot-password page must expose: an email input with the
 * login form's "Email" placeholder, and a submit button whose accessible
 * name mentions sending or resetting ("Send reset email", "Reset
 * password", ...).
 */
export async function requestResetAndGetLink(
  page: Page,
  email: string,
): Promise<string | null> {
  await page.goto("/forgot-password");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: /send|reset/i }).click();

  // The reset email must be distinguishable from the welcome email
  // ("Welcome to Lets do homework!") and the verification email by its
  // subject mentioning the password.
  const summary = await waitForMailpitMessage(email, (message) =>
    /password/i.test(message.Subject ?? ""),
  );
  expect(
    summary,
    `reset email to ${email} should appear in Mailpit`,
  ).toBeTruthy();
  return extractResetLink(summary!.ID);
}

// The reset form mirrors the sign-up form (src/routes/_auth/sign-up.tsx):
// a "Password" input and a "Confirm Password" input, validated by the same
// zod rules and messages.
export async function fillResetForm(
  page: Page,
  password: string,
  confirmPassword: string,
) {
  // Sequential on purpose. Concurrent Playwright fills interleave their
  // focus and typing steps, so both values can land in the input focused
  // last; the race reproduces on a static page, so no app change can make
  // concurrent fills safe (see Playwright's "actions are not run
  // concurrently" guidance).
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page
    .getByPlaceholder("Confirm Password", { exact: true })
    .fill(confirmPassword);
}
