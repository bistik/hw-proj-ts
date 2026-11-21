import {
  countMailpitMessages,
  type MailpitMessageSummary,
} from "../e2e/helpers/mailpit";

// This suite runs its own dev server on a dedicated port (see
// playwright.rate-limit.config.ts). The main e2e server uses port 3100.
export const BASE_URL = "http://localhost:3101";

// Limit values pinned by playwright.rate-limit.config.ts. The spec uses
// them to compute exact thresholds.
export const PER_ADDRESS_LIMIT = 3;
export const PER_IP_LIMIT = 10;

/**
 * Returns an address that no earlier request used. Per-address counters
 * start at zero for it.
 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * Posts the email request form to /api/forgot-password. This is the same
 * request the page's native form sends.
 *
 * redirect: "manual" keeps the 303 visible. The default would follow the
 * redirect and report the final 200.
 */
export async function postForgotPassword(email: string): Promise<Response> {
  const body = new URLSearchParams();
  body.set("email", email);
  return fetch(`${BASE_URL}/api/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
}

/**
 * Signs a user up through the better-auth email API. Returns the raw
 * response, so callers can assert on the status (429 or success).
 */
export async function signUpViaApi(user: {
  name: string;
  email: string;
  password: string;
}): Promise<Response> {
  return fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // better-auth rejects a null origin; send the app's own base URL.
      Origin: BASE_URL,
    },
    body: JSON.stringify(user),
  });
}

/**
 * Polls the Mailpit mailbox until at least `expected` messages match, or
 * until the timeout. Returns the last count.
 *
 * Sends lag behind the HTTP responses. A single read can race, so the
 * count needs polling.
 */
export async function waitForMailpitCount(
  to: string,
  predicate: (message: MailpitMessageSummary) => boolean,
  expected: number,
  timeoutMs = 10_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let count = 0;
  while (Date.now() < deadline) {
    count = await countMailpitMessages(to, predicate);
    if (count >= expected) return count;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return count;
}
