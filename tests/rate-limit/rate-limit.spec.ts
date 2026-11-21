import { expect, test } from "@playwright/test";
import {
  countMailpitMessages,
  isMailpitAvailable,
} from "../e2e/helpers/mailpit";
import {
  PER_ADDRESS_LIMIT,
  PER_IP_LIMIT,
  postForgotPassword,
  postRequestPasswordReset,
  signUpViaApi,
  uniqueEmail,
  waitForMailpitCount,
} from "./helpers";

// Issue #67, TDD red phase: rate-limit the public email-sending endpoints.
// The implementation does not exist yet. These tests define its contract
// and must fail until it exists.
//
// Contract:
//  1. POST /api/forgot-password counts requests per target address. After
//     EMAIL_RATE_LIMIT_PER_ADDRESS (3 here) requests for one address,
//     further requests answer 429 and send no more email. The same limit
//     applies to POST /api/auth/request-password-reset, which emails the
//     same reset link and carries the address in its JSON body.
//  2. The per-address limit applies to the address only. A block on one
//     address does not affect other addresses.
//  3. The endpoint also counts requests per client IP. A burst to many
//     different addresses from one IP stops at EMAIL_RATE_LIMIT_PER_IP
//     (20 here). Requests for addresses without an account count too: the
//     endpoint answers them like existing ones, so the limiter must not
//     depend on account existence.
//  4. The per-IP bucket is shared by all email-sending endpoints. When
//     forgot-password requests fill it, POST /api/auth/sign-up/email
//     answers 429 and sends no email.
//  5. Every 429 carries a Retry-After header with a positive number of
//     seconds.
//
// The limiter counts requests, not individual emails: one sign-up request
// consumes one slot even when it triggers two emails.
//
// The limiter must stay active in dev and E2E mode. The implementation
// must not disable it when E2E=1, or these tests cannot exercise it.
//
// Limits are read from env vars: EMAIL_RATE_LIMIT_PER_ADDRESS,
// EMAIL_RATE_LIMIT_PER_IP, EMAIL_RATE_LIMIT_WINDOW_SECONDS. Production may
// use other defaults. This suite pins 3/20/900 in
// playwright.rate-limit.config.ts.
//
// Test order matters. All tests run on one client IP (localhost) against
// one dev server, so they share the per-IP bucket. Tests run in file order
// (workers: 1), and each test documents its share of the bucket. The suite
// must start a fresh server (reuseExistingServer: false).

/** Asserts contract 5: a 429 carries a positive Retry-After value. */
function expectRetryAfter(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  expect(retryAfter, "a 429 response must carry Retry-After").toBeTruthy();
  expect(
    Number(retryAfter),
    "Retry-After must be a positive number of seconds",
  ).toBeGreaterThan(0);
}

test.describe("rate limit on email-sending endpoints (issue #67)", () => {
  test("caps forgot-password requests per target address, then answers 429 without more email", async () => {
    const email = uniqueEmail("rate-limit-address");
    // The sign-up consumes 1 of the 20 per-IP slots (contract: requests
    // count, not emails). Bucket after this test: 1 sign-up + 4
    // forgot-password requests = 5 slots at most.
    const signUp = await signUpViaApi({
      name: "Rate Limit Address User",
      email,
      password: "rate-limit-1234",
    });
    expect(signUp.ok, "sign-up must succeed: the bucket is empty").toBe(true);

    for (let i = 1; i <= PER_ADDRESS_LIMIT; i++) {
      const response = await postForgotPassword(email);
      expect(
        response.status,
        `request ${i} of ${PER_ADDRESS_LIMIT} is under the per-address limit`,
      ).toBe(303);
    }

    // The reset emails can lag behind the responses. Poll until all three
    // are in the mailbox before the blocked request.
    if (await isMailpitAvailable()) {
      const count = await waitForMailpitCount(
        email,
        (message) => /password/i.test(message.Subject ?? ""),
        PER_ADDRESS_LIMIT,
      );
      expect(count).toBe(PER_ADDRESS_LIMIT);
    }

    const blocked = await postForgotPassword(email);
    expect(blocked.status).toBe(429);
    expectRetryAfter(blocked);

    if (await isMailpitAvailable()) {
      // Wait out any in-flight send, then prove the blocked request sent
      // no fourth email.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const count = await countMailpitMessages(email, (message) =>
        /password/i.test(message.Subject ?? ""),
      );
      expect(count).toBe(PER_ADDRESS_LIMIT);
    }
  });

  test("caps request-password-reset requests per target address, then answers 429 without more email", async () => {
    // request-password-reset is better-auth's own endpoint for the same
    // reset email as forgot-password. It must obey the same per-address
    // limit (contract 1), so the limiter reads the address from its JSON
    // body. Without that check the endpoint bypasses both buckets.
    const email = uniqueEmail("rate-limit-reset");
    // The sign-up consumes 1 of the per-IP slots (requests count, not
    // emails). Bucket after this test: 5 + 1 sign-up + 4 requests = 10
    // slots at most.
    const signUp = await signUpViaApi({
      name: "Rate Limit Reset User",
      email,
      password: "rate-limit-1234",
    });
    expect(signUp.ok, "sign-up must succeed: the bucket has room").toBe(true);

    for (let i = 1; i <= PER_ADDRESS_LIMIT; i++) {
      const response = await postRequestPasswordReset(email);
      expect(
        response.status,
        `request ${i} of ${PER_ADDRESS_LIMIT} is under the per-address limit`,
      ).toBe(200);
    }

    // The reset emails can lag behind the responses. Poll until all three
    // are in the mailbox before the blocked request.
    if (await isMailpitAvailable()) {
      const count = await waitForMailpitCount(
        email,
        (message) => /password/i.test(message.Subject ?? ""),
        PER_ADDRESS_LIMIT,
      );
      expect(count).toBe(PER_ADDRESS_LIMIT);
    }

    const blocked = await postRequestPasswordReset(email);
    expect(blocked.status).toBe(429);
    expectRetryAfter(blocked);

    if (await isMailpitAvailable()) {
      // Wait out any in-flight send, then prove the blocked request sent
      // no fourth email.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const count = await countMailpitMessages(email, (message) =>
        /password/i.test(message.Subject ?? ""),
      );
      expect(count).toBe(PER_ADDRESS_LIMIT);
    }
  });

  test("a per-address block does not affect other addresses", async () => {
    // The previous tests blocked two addresses. This test uses a fresh
    // one. Bucket so far: 10 slots at most. The sign-up below takes 1
    // more, the request 1 more: 12 of 20, still under the per-IP limit.
    const email = uniqueEmail("rate-limit-other");
    const signUp = await signUpViaApi({
      name: "Rate Limit Other User",
      email,
      password: "rate-limit-1234",
    });
    expect(signUp.ok).toBe(true);

    const response = await postForgotPassword(email);
    expect(
      response.status,
      "a fresh address must stay unaffected by another address's block",
    ).toBe(303);
  });

  test("caps the total per client IP across many addresses", async () => {
    // Bucket so far: 12 slots at most. These requests use fresh addresses
    // without an account. They must count anyway (contract 3): the
    // endpoint answers unknown addresses like existing ones.
    const maxAttempts = PER_IP_LIMIT + 5;
    let blocked = false;
    let successes = 0;
    for (let i = 0; i < maxAttempts && !blocked; i++) {
      const response = await postForgotPassword(
        uniqueEmail("rate-limit-burst"),
      );
      if (response.status === 429) {
        blocked = true;
        expectRetryAfter(response);
      } else {
        expect(response.status).toBe(303);
        successes++;
      }
    }

    expect(
      blocked,
      `no 429 within ${maxAttempts} requests from one IP: the per-IP limit is missing or too high`,
    ).toBe(true);
    // 20 slots exist and 12 are used at most, so at most 8 of these
    // requests can succeed. A larger number means the limit is not
    // honored. At least 1 must succeed, or earlier tests already filled
    // the bucket.
    expect(successes).toBeLessThanOrEqual(PER_IP_LIMIT - 12);
    expect(successes).toBeGreaterThanOrEqual(1);
  });

  test("shares the per-IP bucket with sign-up: a full bucket blocks sign-up with 429 and no email", async () => {
    // The previous test filled the shared per-IP bucket: its 429 proved
    // the bucket is full. One sign-up attempt must be blocked now
    // (contract 4).
    const email = uniqueEmail("rate-limit-signup");
    const response = await signUpViaApi({
      name: "Rate Limit Sign-up User",
      email,
      password: "rate-limit-1234",
    });
    expect(response.status).toBe(429);
    expectRetryAfter(response);

    if (await isMailpitAvailable()) {
      // Wait out any in-flight send, then prove the blocked sign-up sent
      // no email at all.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const count = await countMailpitMessages(email, () => true);
      expect(count).toBe(0);
    }
  });
});
