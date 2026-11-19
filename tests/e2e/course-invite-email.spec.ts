import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { getMailpitMessage, isMailpitAvailable, waitForMailpitMessage } from "./helpers/mailpit";
import { OTHER_USER } from "./test-user";

// Issue #24: send an email when a user is invited to a course. The local
// acceptance test is "mailpit should get an invite email".
//
// Issue #31 extends the coverage: the invite email must also go out for
// an unregistered invitee, addressed only through the invite form's
// email text field.
//
// The tag lets CI (or any run) exclude this spec with
// `playwright test --grep-invert @mailpit` if Mailpit is unavailable there.
// In addition, the suite auto-skips whenever Mailpit does not answer, so a
// normal CI run needs no workflow change at all.
test.describe("course invite email", { tag: "@mailpit" }, () => {
  test("sends an invite email when a student is invited to a course", async ({
    page,
  }) => {
    test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page);

    const title = `Invite email course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course whose invite must trigger an email.",
    });

    // Same flow as the "enrolling a student through the form marks them as
    // invited" spec in course-detail.spec.ts: the invite is submitted from
    // the course detail page's enrollments tab.
    await page.goto(`${coursePath}?tab=enrollments`);
    await expect(page).toHaveURL(/tab=enrollments/);
    // Let the route's loaders (and React hydration) settle, so the select's
    // onChange handler is attached before an option is picked.
    await page.waitForLoadState("networkidle");

    const studentSelect = page.locator('fieldset:has-text("Student") select');
    await studentSelect.selectOption({
      label: `${OTHER_USER.name} - ${OTHER_USER.email}`,
    });
    await page.getByRole("button", { name: "Send invite" }).click();

    // Mailpit should receive an email addressed to the invited student.
    // Other specs in this suite also invite the same student (course-detail
    // spec), so older invite emails are already in the mailbox. The subject
    // carries the unique course title, which disambiguates from those.
    const summary = await waitForMailpitMessage(OTHER_USER.email, (message) => {
      const subject = message.Subject ?? "";
      return /invit/i.test(subject) && subject.includes(title);
    });
    expect(
      summary,
      `invite email to ${OTHER_USER.email} should appear in Mailpit`,
    ).toBeTruthy();

    const message = await getMailpitMessage(summary!.ID);
    expect(message, `full Mailpit message ${summary!.ID}`).toBeTruthy();

    expect(message!.Subject).toMatch(/invit/i);
    // The student must be able to tell which course the invite is for, so
    // the unique course title has to appear in the body.
    const body = `${message!.HTML ?? ""}\n${message!.Text ?? ""}`;
    expect(body).toContain(title);
  });

  test("sends an invite email when an unregistered user is invited by email", async ({
    page,
  }) => {
    test.skip(!(await isMailpitAvailable()), "Mailpit is not reachable, skipping");

    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page);

    const title = `Unregistered invite course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course whose unregistered invite must trigger an email.",
    });

    // Same page as the spec above, but the invitee is addressed only
    // through the email text field: no seeded user owns the address.
    await page.goto(`${coursePath}?tab=enrollments`);
    await expect(page).toHaveURL(/tab=enrollments/);
    // Let the route's loaders (and React hydration) settle, so the
    // submit handler is attached before the button is clicked.
    await page.waitForLoadState("networkidle");

    const inviteForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Send invite" }),
    });
    const unregisteredEmail = `e2e-unregistered-${Date.now()}@example.test`;
    await inviteForm.getByRole("textbox", { name: /email/i }).fill(unregisteredEmail);
    await page.getByRole("button", { name: "Send invite" }).click();

    // Mailpit must receive an email addressed to the unregistered
    // invitee. The address is unique to this run, so no older message
    // can satisfy the assertion.
    const summary = await waitForMailpitMessage(unregisteredEmail, (message) => {
      const subject = message.Subject ?? "";
      return /invit/i.test(subject) && subject.includes(title);
    });
    expect(
      summary,
      `invite email to ${unregisteredEmail} should appear in Mailpit`,
    ).toBeTruthy();

    const message = await getMailpitMessage(summary!.ID);
    expect(message, `full Mailpit message ${summary!.ID}`).toBeTruthy();

    expect(message!.Subject).toMatch(/invit/i);
    // The invitee must be able to tell which course the invite is for,
    // so the unique course title has to appear in the body.
    const body = `${message!.HTML ?? ""}\n${message!.Text ?? ""}`;
    expect(body).toContain(title);
  });
});
