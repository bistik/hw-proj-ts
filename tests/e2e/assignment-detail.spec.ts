import { expect, test } from "@playwright/test";
import {
  ensureSignedUp,
  expectRedirectedToLogin,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { seedAssignments } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

test.describe("assignment detail page", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    // The id itself doesn't matter: the _authenticated layout's beforeLoad
    // redirect fires before any assignment loader runs.
    await expectRedirectedToLogin(page, "/assignments/1");
  });

  test("each assignment title on the assignments tab links to the assignment detail page", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `Assignment links course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course with seeded assignments to link through.",
    });
    const courseId = Number(coursePath.split("/")[2]);

    // Two assignments, so the test proves each entry links to its own detail
    // page and not to some shared target.
    const [assignmentId1, assignmentId2] = await seedAssignments(courseId, [
      "Linkable assignment one",
      "Linkable assignment two",
    ]);

    await page.goto(`${coursePath}?tab=assignments`);
    await expect(page).toHaveURL(/tab=assignments/);

    // Each entry's title is a link whose target is that assignment's detail
    // page: /assignments/<assignment_id>. The exact-match href selector
    // cannot be satisfied by the tab's "Edit assignment" links, which point
    // at /assignments/<assignment_id>/edit.
    for (const [assignmentId, assignmentTitle] of [
      [assignmentId1, "Linkable assignment one"],
      [assignmentId2, "Linkable assignment two"],
    ] as const) {
      const titleLink = page.locator(
        `a[href="/assignments/${assignmentId}"]`,
      );
      await expect(titleLink).toBeVisible();
      // The card title itself is the link, not a separate "open" button.
      await expect(titleLink).toContainText(assignmentTitle);
    }

    // Following the first entry's title link lands on that assignment's
    // detail page, and the page shows the assignment.
    await page.locator(`a[href="/assignments/${assignmentId1}"]`).click();
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId1}$`),
    );
    await expect(
      page.getByRole("heading", { name: /Linkable assignment one/ }),
    ).toBeVisible();
  });

  test("non-author gets a 404 instead of the assignment detail page", async ({
    page,
  }) => {
    // Login as the second seeded user and author a course whose assignment
    // TEST_USER must never be able to see.
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page, OTHER_USER);
    const title = `Not TEST_USER's assignment course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course authored by the second E2E user.",
    });
    const courseId = Number(coursePath.split("/")[2]);
    const [assignmentId] = await seedAssignments(courseId, [
      "Other user's assignment",
    ]);
    await logoutViaUi(page);

    // The assignment detail page (src/routes/_authenticated/assignments/
    // $assignmentId/index.tsx) must reject anyone who is not the course
    // author, exactly like the course detail page does: the router's
    // defaultNotFoundComponent.
    await loginViaUi(page, TEST_USER);
    await page.goto(`/assignments/${assignmentId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    // The assignment content must not leak to the non-author.
    await expect(page.getByText("Other user's assignment")).toHaveCount(0);

    // The edit route applies the same guard, so a non-author also gets the
    // not-found page there instead of the edit form.
    await page.goto(`/assignments/${assignmentId}/edit`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(page.getByText("Other user's assignment")).toHaveCount(0);
  });
});
