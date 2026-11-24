import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createAssignmentViaUi } from "./helpers/assignment";
import { createCourseViaUi } from "./helpers/course";
import {
  getAssignmentCheckOnSubmit,
  getAssignmentIdByTitle,
  seedAssignments,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #86: an assignment gets a check_on_submit boolean field.
// Acceptance items:
// 1. /courses/<id>/assignments/new has a checkbox with label
//    'Check answers on submit'.
// 2. /assignments/<id>/edit has the same checkbox.
// 3. The checkbox is off/unchecked by default.
// 4. Only the course author can perform this action (create and edit).
// 5. /assignments/<id> displays the value of the toggle.
//
// The issue does not fix the display text. This spec fixes the
// contract: the detail page renders "Check answers on submit: Yes" for
// a stored-on assignment and "Check answers on submit: No" for a
// stored-off one.
//
// Test-driven development red phase: the forms have no such checkbox
// yet, so the tests below fail until the feature exists.

test.describe("assignment check on submit (issue #86)", () => {
  // Extracts the numeric course id from a "/courses/<id>" path, as
  // returned by createCourseViaUi, so assertions can name exact routes.
  function courseIdOf(coursePath: string): number {
    const id = Number(coursePath.split("/")[2]);
    if (!Number.isInteger(id)) {
      throw new Error(`no course id in path "${coursePath}"`);
    }
    return id;
  }

  // The toggle: a checkbox inside a fieldset whose legend labels it
  // 'Check answers on submit' (same fieldset/legend pattern as the
  // form's Title, Example, and Points fields).
  const checkOnSubmitBoxOf = (page: Page): Locator =>
    page.locator(
      'fieldset:has-text("Check answers on submit") input[type="checkbox"]',
    );

  test("the new assignment form has a 'Check answers on submit' checkbox, off by default", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Check on submit new course ${Date.now()}`,
      description: "Course whose new assignment form must show the toggle.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/assignments/new`);
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/assignments/new$`),
    );

    const checkbox = checkOnSubmitBoxOf(page);
    await expect(checkbox).toBeVisible();
    // Issue #86: the checkbox is off/unchecked by default.
    await expect(checkbox).not.toBeChecked();
  });

  test("the edit assignment form has the same checkbox, off for a stored-off assignment", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Check on submit edit course ${Date.now()}`,
      description: "Course whose assignment edit form must show the toggle.",
    });
    const courseId = courseIdOf(coursePath);
    // seedAssignments writes no check_on_submit, so the row keeps the
    // column default: off.
    const [assignmentId] = await seedAssignments(courseId, [
      "Editable check on submit assignment",
    ]);

    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}/edit$`),
    );

    const checkbox = checkOnSubmitBoxOf(page);
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test("saving with the checkbox on stores it and the detail page shows the value", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Check on submit display course ${Date.now()}`,
      description: "Course whose assignment toggle must show on the detail page.",
    });
    const courseId = courseIdOf(coursePath);

    // Create through the real form with the checkbox on, so this test
    // also proves the create server fn persists the toggle, not only
    // that the detail page could render it.
    const assignmentTitle = `Check on submit display assignment ${Date.now()}`;
    await createAssignmentViaUi(page, courseId, {
      title: assignmentTitle,
      example: "Example for the check on submit display assignment.",
      checkOnSubmit: true,
    });
    const assignmentId = await getAssignmentIdByTitle(
      courseId,
      assignmentTitle,
    );

    // The stored row must hold the toggle value.
    expect(await getAssignmentCheckOnSubmit(assignmentId)).toBe(true);

    await page.goto(`/assignments/${assignmentId}`);
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}$`),
    );

    const titleHeading = page.getByRole("heading", {
      name: /Assignment title:/,
    });
    await expect(titleHeading).toBeVisible();

    // The display contract this spec fixes for issue #86: the stored-on
    // value renders as "Check answers on submit: Yes".
    const toggleText = page.getByText("Check answers on submit: Yes");
    await expect(toggleText).toBeVisible();

    // The toggle text starts at a greater y coordinate than the title
    // heading, like the points text (issue #84).
    const titleBox = await titleHeading.boundingBox();
    const toggleBox = await toggleText.boundingBox();
    expect(titleBox, "the assignment title heading is rendered").toBeTruthy();
    expect(toggleBox, "the toggle text is rendered").toBeTruthy();
    expect(toggleBox!.y).toBeGreaterThan(titleBox!.y);
  });

  test("the detail page shows 'Check answers on submit: No' for a stored-off assignment", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Check on submit off course ${Date.now()}`,
      description: "Course whose assignment toggle stays off.",
    });
    const courseId = courseIdOf(coursePath);
    // seedAssignments writes no check_on_submit, so the row keeps the
    // column default: off.
    const [assignmentId] = await seedAssignments(courseId, [
      "Stored-off check on submit assignment",
    ]);

    // The stored row must hold the off value.
    expect(await getAssignmentCheckOnSubmit(assignmentId)).toBe(false);

    await page.goto(`/assignments/${assignmentId}`);
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}$`),
    );

    // The display contract this spec fixes for issue #86: the
    // stored-off value renders as "Check answers on submit: No".
    await expect(
      page.getByText("Check answers on submit: No"),
    ).toBeVisible();
  });

  test("the edit form prefills the checkbox with the stored value", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Check on submit prefill course ${Date.now()}`,
      description: "Course whose assignment edit form must prefill the toggle.",
    });
    const courseId = courseIdOf(coursePath);

    const assignmentTitle = `Check on submit prefill assignment ${Date.now()}`;
    await createAssignmentViaUi(page, courseId, {
      title: assignmentTitle,
      example: "Example for the check on submit prefill assignment.",
      checkOnSubmit: true,
    });
    const assignmentId = await getAssignmentIdByTitle(
      courseId,
      assignmentTitle,
    );

    // The edit form must not lose the stored value: the checkbox starts
    // checked, so a title-only edit cannot reset it.
    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(checkOnSubmitBoxOf(page)).toBeChecked();
  });

  test("a non-author cannot reach the pages that set the toggle", async ({
    page,
  }) => {
    // OTHER_USER authors a course that TEST_USER must never be able to
    // set the toggle on, through either route.
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page, OTHER_USER);
    const coursePath = await createCourseViaUi(page, {
      title: `Not TEST_USER's check on submit course ${Date.now()}`,
      description: "Authored by the second E2E user.",
    });
    const courseId = courseIdOf(coursePath);
    const [assignmentId] = await seedAssignments(courseId, [
      "Other user's check on submit assignment",
    ]);
    await logoutViaUi(page);

    await loginViaUi(page, TEST_USER);

    // Both routes must reject the non-author with the router's
    // defaultNotFoundComponent, so the checkbox never renders.
    await page.goto(`/courses/${courseId}/assignments/new`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(checkOnSubmitBoxOf(page)).toHaveCount(0);

    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(checkOnSubmitBoxOf(page)).toHaveCount(0);
  });
});
