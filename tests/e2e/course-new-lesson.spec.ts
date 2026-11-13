import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";

// Issue #17: the course detail Lessons tab is missing the entry point into
// lesson creation. Three acceptance items:
// 1. /courses/<id>?tab=lessons shows a link to add a lesson.
// 2. That link navigates to /courses/<id>/lessons/new.
// 3. /courses/<id>/lessons/new renders breadcrumbs:
//    course title (link to /courses/<id>) > "New lesson" (text only).
test.describe("add a new lesson", () => {
  // Extracts the numeric course id from a "/courses/<id>" path, as returned
  // by createCourseViaUi, so assertions can name exact routes.
  function courseIdOf(coursePath: string): number {
    const id = Number(coursePath.split("/")[2]);
    if (!Number.isInteger(id)) {
      throw new Error(`no course id in path "${coursePath}"`);
    }
    return id;
  }

  test("the lessons tab has a link to add a lesson", async ({ page }) => {
    await loginViaUi(page);

    const title = `Add lesson course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course whose Lessons tab must link to lesson creation.",
    });

    await page.goto(`${coursePath}?tab=lessons`);
    await expect(page).toHaveURL(/tab=lessons/);
    await expect(page.getByRole("radio", { name: "Lessons" })).toBeChecked();

    // No lesson seeding is needed: the link must be present in the empty
    // state too ("No lessons yet"), not only once lessons exist.
    const addLessonLink = page.getByRole("link", { name: "add a lesson" });
    await expect(addLessonLink).toBeVisible();
  });

  test("the add-a-lesson link goes to the course's new lesson page", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `New lesson link course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course to follow the add-a-lesson link from.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`${coursePath}?tab=lessons`);
    await expect(page).toHaveURL(/tab=lessons/);
    // Let the route's loaders (and React hydration) settle before clicking:
    // a click issued while the initial loaders are still pending can be
    // dropped by the router (no history push, UI/URL desync).
    await page.waitForLoadState("networkidle");

    // The link is course-scoped: it must lead to this course's lesson form,
    // not the global /lessons/new page (which asks for a course via a
    // select instead of knowing the course from the URL).
    await page.getByRole("link", { name: "add a lesson" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/lessons/new$`),
    );
  });

  test("the new lesson page shows breadcrumbs: course title link > New lesson text", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `New lesson crumb course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course whose title must appear in the breadcrumb trail.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/lessons/new`);
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/lessons/new$`),
    );

    // The breadcrumb trail (daisyUI .breadcrumbs, see
    // src/components/common/breadcrumbs.tsx) has two crumbs:
    // - the course title as a link back to the course page;
    // - the current page's name as plain text (not a link), like the
    //   trail on the submission review page.
    const breadcrumbs = page.locator(".breadcrumbs");

    const courseCrumb = breadcrumbs.getByRole("link", { name: title });
    await expect(courseCrumb).toBeVisible();
    await expect(courseCrumb).toHaveAttribute("href", `/courses/${courseId}`);

    // exact: true, because the course title itself may contain "New
    // lesson" (e.g. "New lesson crumb course ...") and getByText without
    // exact matches substrings, colliding with the title link above.
    const newLessonCrumb = breadcrumbs.getByText("New lesson", { exact: true });
    await expect(newLessonCrumb).toBeVisible();
    // "New lesson" is the current page: text only, never a link.
    await expect(newLessonCrumb).not.toHaveRole("link");
    await expect(
      breadcrumbs.getByRole("link", { name: "New lesson", exact: true }),
    ).toHaveCount(0);
  });
});
