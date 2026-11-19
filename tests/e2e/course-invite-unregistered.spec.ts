import { expect, test, type Page } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { OTHER_USER } from "./test-user";

// Issue #31: invite unregistered users to a course by email.
//
// The send-invite form on the course detail page (enrollments tab)
// must offer two inputs: the existing <select> with registered users,
// and a new text field for an unregistered user's email address. The
// two inputs are mutually exclusive. Exactly one is required:
//
// - neither filled: the submission must fail validation;
// - both filled: the submission must fail validation;
// - exactly one filled: the submission passes.
//
// The select-only pass case is already covered by course-detail.spec.ts
// ("enrolling a student through the form marks them as invited"), so
// this spec covers the two failure cases and the email-only pass case.
// The end-to-end proof that the invite email reaches the unregistered
// address lives in the @mailpit spec (course-invite-email.spec.ts).

/**
 * The invite form, located through its unique "Send invite" button.
 */
function inviteFormOf(page: Page) {
  return page.locator("form").filter({
    has: page.getByRole("button", { name: "Send invite" }),
  });
}

/**
 * The visible error indication inside the invite form: either the
 * form-level FormErrorAlert (role=alert) or a field error paragraph
 * (p.text-error, the repo's field-error markup). Which one the
 * implementation shows is free to choose. The contract is only "a
 * validation failure becomes visible".
 */
function errorIndicationOf(page: Page) {
  return inviteFormOf(page).locator('[role="alert"], .text-error');
}

/**
 * The text field for an unregistered user's email address. Located by
 * role and by an accessible name that contains "email", so the
 * implementation is free in how it labels the field.
 */
function emailFieldOf(page: Page) {
  return inviteFormOf(page).getByRole("textbox", { name: /email/i });
}

test.describe("invite unregistered user (issue #31)", () => {
  test("submitting with neither a user nor an email fails validation", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page);

    const title = `Invite empty course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course for the invite form's empty-submit case.",
    });

    await page.goto(`${coursePath}?tab=enrollments`);
    await expect(page).toHaveURL(/tab=enrollments/);
    // Let the route's loaders (and React hydration) settle, so the
    // submit handler is attached before the button is clicked.
    await page.waitForLoadState("networkidle");

    // Neither input is touched: the select keeps its placeholder option
    // and the email text field stays empty.
    await page.getByRole("button", { name: "Send invite" }).click();

    // The submission must fail with a visible error.
    await expect(errorIndicationOf(page)).toBeVisible();
  });

  test("submitting with both a user and an email fails validation", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page);

    const title = `Invite both course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course for the invite form's both-filled case.",
    });

    await page.goto(`${coursePath}?tab=enrollments`);
    await expect(page).toHaveURL(/tab=enrollments/);
    // Let the route's loaders (and React hydration) settle, so the
    // select's onChange handler is attached before an option is picked.
    await page.waitForLoadState("networkidle");

    // Fill both inputs: pick a registered user in the select and enter
    // an email address in the new text field.
    const studentSelect = page.locator('fieldset:has-text("Student") select');
    await studentSelect.selectOption({
      label: `${OTHER_USER.name} - ${OTHER_USER.email}`,
    });
    await emailFieldOf(page).fill(`both-filled-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "Send invite" }).click();

    // The submission must fail with a visible error.
    await expect(errorIndicationOf(page)).toBeVisible();

    // A validation failure must not reach the server: the roster must
    // not gain the selected user as an invited enrollee.
    await expect(
      page.getByRole("listitem").filter({ hasText: OTHER_USER.email }),
    ).toHaveCount(0);
  });

  test("submitting with only an email passes validation", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page);

    const title = `Unregistered invite course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course for the invite form's email-only case.",
    });

    await page.goto(`${coursePath}?tab=enrollments`);
    await expect(page).toHaveURL(/tab=enrollments/);
    // Let the route's loaders (and React hydration) settle, so the
    // submit handler is attached before the button is clicked.
    await page.waitForLoadState("networkidle");

    // Fill only the email field. The address belongs to no seeded
    // user: the invitee is unregistered.
    const unregisteredEmail = `e2e-unregistered-${Date.now()}@example.test`;
    await emailFieldOf(page).fill(unregisteredEmail);
    await page.getByRole("button", { name: "Send invite" }).click();

    // The submission must succeed: no validation error and no
    // form-level failure alert may appear. Let the server call settle
    // before the absence assertion runs.
    await page.waitForLoadState("networkidle");
    await expect(errorIndicationOf(page)).toHaveCount(0);

    // How the invite surfaces in the user interface for a user without
    // an account is open for research per issue #31. The end-to-end
    // proof (the invite email reaching the unregistered address) is
    // covered by the @mailpit spec, course-invite-email.spec.ts.
  });
});
