import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";

// Issue #16: the course detail Assignments tab is missing the entry point
// into assignment creation. Three acceptance items:
// 1. /courses/<id>?tab=assignments shows a link to add an assignment.
// 2. That link navigates to /courses/<id>/assignments/new.
// 3. /courses/<id>/assignments/new renders breadcrumbs:
//    course title (link to /courses/<id>) > "New assignment" (text only).
test.describe("add a new assignment", () => {
  // Extracts the numeric course id from a "/courses/<id>" path, as returned
  // by createCourseViaUi, so assertions can name exact routes.
  function courseIdOf(coursePath: string): number {
    const id = Number(coursePath.split("/")[2]);
    if (!Number.isInteger(id)) {
      throw new Error(`no course id in path "${coursePath}"`);
    }
    return id;
  }

  test("the assignments tab has a link to add an assignment", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `Add assignment course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course whose Assignments tab must link to assignment creation.",
    });

    await page.goto(`${coursePath}?tab=assignments`);
    await expect(page).toHaveURL(/tab=assignments/);
    await expect(page.getByRole("radio", { name: "Assignments" })).toBeChecked();

    // No assignment seeding is needed: the link must be present in the
    // empty state too ("No assignments yet"), not only once assignments
    // exist.
    const addAssignmentLink = page.getByRole("link", { name: "Add assignment" });
    await expect(addAssignmentLink).toBeVisible();
  });

  test("the add-an-assignment link goes to the course's new assignment page", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `New assignment link course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course to follow the add-an-assignment link from.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`${coursePath}?tab=assignments`);
    await expect(page).toHaveURL(/tab=assignments/);
    // Assert the link is ready before clicking: a click issued while the
    // initial loaders are still pending can be dropped by the router
    // (no history push, UI/URL desync). Visible and enabled is enough;
    // networkidle is slow and flaky, so it is not used here.
    const addAssignmentLink = page.getByRole("link", { name: "Add assignment" });
    await expect(addAssignmentLink).toBeVisible();
    await expect(addAssignmentLink).toBeEnabled();

    // The link is course-scoped: it must lead to this course's assignment
    // form, not the global /assignments/new page (which asks for a course
    // via a select instead of knowing the course from the URL).
    await addAssignmentLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/assignments/new$`),
    );
  });

  test("the new assignment page shows breadcrumbs: course title link > New assignment text", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `New assignment crumb course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course whose title must appear in the breadcrumb trail.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/assignments/new`);
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/assignments/new$`),
    );

    // The breadcrumb trail (daisyUI .breadcrumbs, see
    // src/components/common/breadcrumbs.tsx) has two crumbs:
    // - the course title as a link back to the course page;
    // - the current page's name as plain text (not a link), like the
    //   trail on the new lesson page.
    const breadcrumbs = page.locator(".breadcrumbs");

    const courseCrumb = breadcrumbs.getByRole("link", { name: title });
    await expect(courseCrumb).toBeVisible();
    await expect(courseCrumb).toHaveAttribute("href", `/courses/${courseId}`);

    // exact: true, because the course title itself may contain "New
    // assignment" (e.g. "New assignment crumb course ...") and getByText
    // without exact matches substrings, colliding with the title link
    // above.
    const newAssignmentCrumb = breadcrumbs.getByText("New assignment", {
      exact: true,
    });
    await expect(newAssignmentCrumb).toBeVisible();
    // "New assignment" is the current page: text only, never a link.
    await expect(newAssignmentCrumb).not.toHaveRole("link");
    await expect(
      breadcrumbs.getByRole("link", { name: "New assignment", exact: true }),
    ).toHaveCount(0);
  });
});
