import { expect, test } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { seedLesson } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #20: the lesson edit page is missing breadcrumbs and lives at a
// global route. It moves to a course-scoped route. Acceptance items:
// 1. There is a page at /courses/<id>/lessons/<id>/edit.
// 2. Its content is similar to the current /lessons/<id>/edit page.
// 3. /lessons/<id>/edit is a 404 (the URL is replaced).
// 4. /courses/<id>/lessons/<id>/edit shows breadcrumbs:
//    [Course title] > [Lesson title].
// 5. Submitting the form redirects to /courses/<id>?tab=lessons.
// 6. The page is accessible to the course author only.
test.describe("edit a lesson on the course-scoped page", () => {
  // Extracts the numeric course id from a "/courses/<id>" path, as returned
  // by createCourseViaUi, so assertions can name exact routes.
  function courseIdOf(coursePath: string): number {
    const id = Number(coursePath.split("/")[2]);
    if (!Number.isInteger(id)) {
      throw new Error(`no course id in path "${coursePath}"`);
    }
    return id;
  }

  const editPathOf = (courseId: number, lessonId: number) =>
    `/courses/${courseId}/lessons/${lessonId}/edit`;

  test("the edit page exists at /courses/<id>/lessons/<id>/edit", async ({
    page,
  }) => {
    await loginViaUi(page);

    const courseTitle = `Edit lesson course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title: courseTitle,
      description: "Course hosting a lesson to edit.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonTitle = `Editable lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Original content of ${lessonTitle}`,
    });

    await page.goto(editPathOf(courseId, lessonId));
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/lessons/${lessonId}/edit$`),
    );

    // The URL alone is not enough (a 404 keeps it): the edit form itself
    // must render on this route.
    await expect(
      page.locator('fieldset:has-text("Title") input'),
    ).toBeVisible();
  });

  test("the edit page shows the same form as the old lesson edit page", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Edit form course ${Date.now()}`,
      description: "Course whose lesson edit form is checked.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonTitle = `Form check lesson ${Date.now()}`;
    const lessonContent = `Original content of ${lessonTitle}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: lessonContent,
    });

    await page.goto(editPathOf(courseId, lessonId));

    // "Similar content" to the old /lessons/<id>/edit page this change
    // replaces (it now lives at /courses/<id>/lessons/<id>/edit): a form
    // with Title and Content fields, both prefilled with the lesson's
    // values, and an "Update lesson" submit button.
    await expect(
      page.locator('fieldset:has-text("Title") input'),
    ).toHaveValue(lessonTitle);
    await expect(
      page.locator('fieldset:has-text("Content") textarea'),
    ).toHaveValue(lessonContent);
    await expect(
      page.getByRole("button", { name: "Update lesson" }),
    ).toBeVisible();
  });

  test("the old /lessons/<id>/edit route is a 404", async ({ page }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Old route course ${Date.now()}`,
      description: "Course whose lesson must lose the global edit route.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonId = await seedLesson(courseId, {
      title: `Old route lesson ${Date.now()}`,
      content: "Content of the lesson with the removed global route.",
    });

    // The URL is replaced, not kept: the global edit route is gone and
    // any lesson id must land on the router's 404 page.
    await page.goto(`/lessons/${lessonId}/edit`);
    await expect(page).toHaveURL(
      new RegExp(`/lessons/${lessonId}/edit$`),
    );
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(
      page.locator('fieldset:has-text("Title") input'),
    ).toHaveCount(0);
  });

  test("the edit page shows breadcrumbs: course title link > lesson title text", async ({
    page,
  }) => {
    await loginViaUi(page);

    const courseTitle = `Crumb course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title: courseTitle,
      description: "Course whose title must appear in the breadcrumb trail.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonTitle = `Crumb lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Original content of ${lessonTitle}`,
    });

    await page.goto(editPathOf(courseId, lessonId));

    // The breadcrumb trail (daisyUI .breadcrumbs, see
    // src/components/common/breadcrumbs.tsx) has two crumbs:
    // - the course title as a link back to the course page;
    // - the lesson title as plain text (not a link), like the "New
    //   lesson" crumb on the course-scoped creation page.
    const breadcrumbs = page.locator(".breadcrumbs");

    const courseCrumb = breadcrumbs.getByRole("link", { name: courseTitle });
    await expect(courseCrumb).toBeVisible();
    await expect(courseCrumb).toHaveAttribute("href", `/courses/${courseId}`);

    // exact: true, because the lesson title may contain the course title
    // as a substring and getByText without exact matches substrings.
    const lessonCrumb = breadcrumbs.getByText(lessonTitle, { exact: true });
    await expect(lessonCrumb).toBeVisible();
    // The lesson title is the current page: text only, never a link.
    await expect(lessonCrumb).not.toHaveRole("link");
    await expect(
      breadcrumbs.getByRole("link", { name: lessonTitle, exact: true }),
    ).toHaveCount(0);
  });

  test("submitting the form redirects to the course's lessons tab", async ({
    page,
  }) => {
    await loginViaUi(page);

    const courseTitle = `Redirect course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title: courseTitle,
      description: "Course to return to after editing a lesson.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonTitle = `Redirect lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Original content of ${lessonTitle}`,
    });

    await page.goto(editPathOf(courseId, lessonId));
    // Wait for hydration so the React submit handler intercepts the click
    // instead of a native GET form submit (same pattern as loginViaUi).
    await page.waitForLoadState("networkidle");

    const newTitle = `Renamed lesson ${Date.now()}`;
    await page.locator('fieldset:has-text("Title") input').fill(newTitle);
    await page.getByRole("button", { name: "Update lesson" }).click();

    // The redirect goes to the course page with the Lessons tab active,
    // where the renamed lesson must now be listed.
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}\\?tab=lessons$`),
    );
    await expect(page.getByRole("radio", { name: "Lessons" })).toBeChecked();
    await expect(page.getByText(newTitle)).toBeVisible();
  });

  test("non-author gets a 404 instead of the edit page", async ({ page }) => {
    // OTHER_USER authors a course that TEST_USER must never be able to
    // edit through the course-scoped route.
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page, OTHER_USER);
    const courseTitle = `Not TEST_USER's course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title: courseTitle,
      description: "Authored by the second E2E user.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonId = await seedLesson(courseId, {
      title: `Other user's lesson ${Date.now()}`,
      content: "Content of the lesson TEST_USER must not edit.",
    });
    await logoutViaUi(page);

    // The route loader must look the lesson up through its course's
    // author; a logged-in user who is not the author is thrown to the
    // router's defaultNotFoundComponent.
    await loginViaUi(page, TEST_USER);
    await page.goto(editPathOf(courseId, lessonId));
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(
      page.locator('fieldset:has-text("Title") input'),
    ).toHaveCount(0);
  });
});
