import { expect, test, type Page } from "@playwright/test";

// Issue #60: the /sign-up form must guard against double submission.
// While better-auth creates the account, the [Signup] button must
// disable and show a loading animation. After the redirect, the
// dashboard must tell the user that the registration succeeded and
// that the email address needs verification.

// How long the sign-up POST stays in flight. The delay widens the
// in-flight window so tests can observe the pending state (disabled
// button, loading animation) deterministically. Mirrors
// slowServerFnCalls (helpers/server-fn.ts); the sign-up form posts to
// better-auth's /api/auth endpoint, not /_serverFn, so it needs its
// own route.
const SIGNUP_DELAY_MS = 500;

type SignUpUser = { name: string; email: string; password: string };

/**
 * A fresh user per test, so the address is new in every run. The name
 * avoids the words the dashboard notice assertions look for
 * ("registered", "signed up", "verify"), so the greeting cannot match
 * them.
 */
function uniqueUser(label: string): SignUpUser {
  const now = Date.now();
  return {
    name: "Double Submit Guard User",
    email: `double-submit-guard-${label}-${now}@example.test`,
    password: "double-submit-guard-password-1234",
  };
}

/**
 * Delays every POST /api/auth/sign-up/email the page makes.
 */
async function slowSignUpCalls(page: Page): Promise<void> {
  await page.route("**/api/auth/sign-up/email", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SIGNUP_DELAY_MS));
    await route.continue();
  });
}

/**
 * Fills the /sign-up form for `user`.
 *
 * The fields are addressed by their fieldset legends (the accessible
 * names of the "group" role): the two password fields share the
 * "Password" placeholder, so placeholders cannot tell them apart.
 * Sequential on purpose; see fillResetForm (helpers/forgot-password.ts).
 */
async function fillSignUpForm(page: Page, user: SignUpUser): Promise<void> {
  await page
    .getByRole("group", { name: "Name", exact: true })
    .locator("input")
    .fill(user.name);
  await page
    .getByRole("group", { name: "Email", exact: true })
    .locator("input")
    .fill(user.email);
  await page
    .getByRole("group", { name: "Password", exact: true })
    .locator("input")
    .fill(user.password);
  await page
    .getByRole("group", { name: "Confirm Password", exact: true })
    .locator("input")
    .fill(user.password);
}

/**
 * Clicks the [Signup] button until the submit actually starts.
 *
 * Like clickAddQuestionButton
 * (author-add-question-double-submit.spec.ts): in dev the first click
 * can race the module graph load and do nothing. The submit has
 * started once the page posts the sign-up request to
 * /api/auth/sign-up/email; that is implementation independent (it
 * fires before issue #60's pending UI exists).
 */
async function clickSignUpButton(
  page: Page,
  user: SignUpUser,
): Promise<void> {
  const button = page.getByRole("button", { name: "Signup", exact: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const submitStarted = page
      .waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes("/api/auth/sign-up/email"),
        { timeout: 2000 },
      )
      .catch(() => null);
    await button.click();
    if (await submitStarted) return;
    // The click raced hydration and did nothing. A native GET submit
    // may have reloaded the form empty, so fill the fields again.
    await fillSignUpForm(page, user);
  }
  throw new Error(
    "clickSignUpButton: the submit never started after 3 attempts",
  );
}

test.describe("sign-up double submission guard (issue #60)", () => {
  test("the Signup button is disabled while the form submits", async ({
    page,
  }) => {
    const user = uniqueUser("disabled");
    await slowSignUpCalls(page);
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
    await fillSignUpForm(page, user);

    const signUpButton = page.getByRole("button", {
      name: "Signup",
      exact: true,
    });
    await clickSignUpButton(page, user);

    // While better-auth creates the account, the button must not accept
    // a second submission.
    await expect(signUpButton).toBeDisabled();
  });

  test("the Signup button shows a loading animation while the form submits", async ({
    page,
  }) => {
    const user = uniqueUser("loading");
    await slowSignUpCalls(page);
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
    await fillSignUpForm(page, user);

    const signUpButton = page.getByRole("button", {
      name: "Signup",
      exact: true,
    });
    await clickSignUpButton(page, user);

    // Like the Add question button (issue #51), the pending button
    // shows the daisyUI loading spinner.
    await expect(signUpButton.locator(".loading")).toBeVisible();

    // The animation ends when the submission completes and the form
    // redirects to the dashboard.
    await expect(signUpButton.locator(".loading")).toHaveCount(0);
  });

  test("a second click during the pending window does not submit twice", async ({
    page,
  }) => {
    const user = uniqueUser("once");
    let signUpRequests = 0;
    await page.route("**/api/auth/sign-up/email", async (route) => {
      signUpRequests++;
      await new Promise((resolve) => setTimeout(resolve, SIGNUP_DELAY_MS));
      await route.continue();
    });
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
    await fillSignUpForm(page, user);

    const signUpButton = page.getByRole("button", {
      name: "Signup",
      exact: true,
    });
    await clickSignUpButton(page, user);

    // The button must already be disabled here, so this forced click is
    // a no-op in the browser: Chromium does not deliver clicks on
    // disabled buttons.
    await signUpButton.click({ force: true });

    // The submission reaches better-auth exactly once: after the
    // redirect to the dashboard, the counter must hold one request.
    await page.waitForURL(/\/dashboard/);
    expect(signUpRequests).toBe(1);
  });

  test("the dashboard tells the user to verify the email after a successful sign-up", async ({
    page,
  }) => {
    const user = uniqueUser("notice");
    // No route delay: this test observes the page after the redirect, not
    // the in-flight window.
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
    await fillSignUpForm(page, user);
    await clickSignUpButton(page, user);

    // The form's onSuccess handler redirects to the dashboard.
    await page.waitForURL(/\/dashboard/);

    // The notice must state both facts: the registration succeeded, and
    // the email address still needs verification.
    await expect(page.getByText(/registered|signed up/i)).toBeVisible();
    await expect(page.getByText(/verify.*email/i)).toBeVisible();
  });
});
