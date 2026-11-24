import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createAssignmentViaUi } from "./helpers/assignment";
import { createCourseViaUi } from "./helpers/course";
import { getAssignmentIdByTitle, seedAssignments } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #84: an assignment gets a points field. Acceptance items:
// 1. /courses/<id>/assignments/new has a dropdown with label 'points'.
// 2. /assignments/<id>/edit has the same dropdown.
// 3. The dropdown offers exactly the values 1 to 10.
// 4. Only the course author can perform this action (create and edit).
// 5. /assignments/<id> displays the points below the assignment title.
//
// Test-driven development red phase: the forms have no points dropdown
// yet, so the tests below fail until the feature exists.

test.describe("assignment points (issue #84)", () => {
  // Extracts the numeric course id from a "/courses/<id>" path, as
  // returned by createCourseViaUi, so assertions can name exact routes.
  function courseIdOf(coursePath: string): number {
    const id = Number(coursePath.split("/")[2]);
    if (!Number.isInteger(id)) {
      throw new Error(`no course id in path "${coursePath}"`);
    }
    return id;
  }

  // The exact option values issue #84 demands: 1 to 10, nothing below 1,
  // nothing above 10, no gaps, in order.
  const expectedPointOptions = Array.from({ length: 10 }, (_, i) =>
    String(i + 1),
  );

  // The points dropdown: a select inside a fieldset whose legend labels
  // it 'points' (same fieldset/legend pattern as the form's Title and
  // Example fields; Playwright's :has-text() is case-insensitive, so
  // "Points" as the legend text satisfies the issue's lowercase 'points').
  const pointsDropdownOf = (page: Page): Locator =>
    page.locator('fieldset:has-text("Points") select');

  // Asserts that a form's points dropdown exists and offers exactly the
  // values 1 to 10: ten options, no more, no less, in order.
  async function expectPointsRange1To10(dropdown: Locator) {
    await expect(dropdown).toBeVisible();
    const optionValues = await dropdown
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
    expect(optionValues).toEqual(expectedPointOptions);
  }

  test("the new assignment form has a points dropdown with values 1 to 10", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Points new course ${Date.now()}`,
      description: "Course whose new assignment form must ask for points.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/assignments/new`);
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/assignments/new$`),
    );

    await expectPointsRange1To10(pointsDropdownOf(page));
  });

  test("the edit assignment form has a points dropdown with values 1 to 10", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Points edit course ${Date.now()}`,
      description: "Course whose assignment edit form must ask for points.",
    });
    const courseId = courseIdOf(coursePath);
    const [assignmentId] = await seedAssignments(courseId, [
      "Editable points assignment",
    ]);

    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}/edit$`),
    );

    await expectPointsRange1To10(pointsDropdownOf(page));
  });

  test("saving the form stores the points and the detail page shows them below the title", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Points display course ${Date.now()}`,
      description: "Course whose assignment points must show on the detail page.",
    });
    const courseId = courseIdOf(coursePath);

    // Create through the real form with points selected from the
    // dropdown, so this test also proves the create server fn persists
    // the points, not only that the detail page could render them.
    const assignmentTitle = `Points display assignment ${Date.now()}`;
    await createAssignmentViaUi(page, courseId, {
      title: assignmentTitle,
      example: "Example for the points display assignment.",
      points: 7,
    });
    const assignmentId = await getAssignmentIdByTitle(
      courseId,
      assignmentTitle,
    );

    await page.goto(`/assignments/${assignmentId}`);
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}$`),
    );

    const titleHeading = page.getByRole("heading", {
      name: /Assignment title:/,
    });
    await expect(titleHeading).toBeVisible();

    // The contract issue #84 fixes for the display: the points render as
    // "Points: 7" below the assignment title heading.
    const pointsText = page.getByText("Points: 7");
    await expect(pointsText).toBeVisible();

    // "Below the title": the points text starts at a greater y
    // coordinate than the title heading.
    const titleBox = await titleHeading.boundingBox();
    const pointsBox = await pointsText.boundingBox();
    expect(titleBox, "the assignment title heading is rendered").toBeTruthy();
    expect(pointsBox, "the points text is rendered").toBeTruthy();
    expect(pointsBox!.y).toBeGreaterThan(titleBox!.y);
  });

  test("the edit form prefills the dropdown with the stored points", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Points prefill course ${Date.now()}`,
      description: "Course whose assignment edit form must prefill the points.",
    });
    const courseId = courseIdOf(coursePath);

    const assignmentTitle = `Points prefill assignment ${Date.now()}`;
    await createAssignmentViaUi(page, courseId, {
      title: assignmentTitle,
      example: "Example for the points prefill assignment.",
      points: 4,
    });
    const assignmentId = await getAssignmentIdByTitle(
      courseId,
      assignmentTitle,
    );

    // The edit form must not lose the stored points: the dropdown starts
    // at the saved value, so a title-only edit cannot reset them.
    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(pointsDropdownOf(page)).toHaveValue("4");
  });

  test("a non-author cannot reach the pages that set the points", async ({
    page,
  }) => {
    // OTHER_USER authors a course that TEST_USER must never be able to
    // set points on, through either route.
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page, OTHER_USER);
    const coursePath = await createCourseViaUi(page, {
      title: `Not TEST_USER's points course ${Date.now()}`,
      description: "Authored by the second E2E user.",
    });
    const courseId = courseIdOf(coursePath);
    const [assignmentId] = await seedAssignments(courseId, [
      "Other user's points assignment",
    ]);
    await logoutViaUi(page);

    await loginViaUi(page, TEST_USER);

    // Both routes must reject the non-author with the router's
    // defaultNotFoundComponent, so the points dropdowns never render.
    await page.goto(`/courses/${courseId}/assignments/new`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(pointsDropdownOf(page)).toHaveCount(0);

    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(pointsDropdownOf(page)).toHaveCount(0);
  });
});
