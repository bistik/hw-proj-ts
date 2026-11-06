import { expect, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  expectRedirectedToLogin,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { seedAssignments, seedLessons } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// The scoped titles must be unique per run, and exact matching keeps them
// from hitting the navbar's "Courses" link.
const courseLink = (page: Page, title: string) =>
  page.getByRole("link", { name: title, exact: true });

test.describe("courses list page", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    // The _authenticated layout's beforeLoad redirect fires before the
    // /courses loader (src/routes/_authenticated/courses/index.tsx) runs.
    await expectRedirectedToLogin(page, "/courses");
  });

  test("shows only the courses authored by the logged-in user", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);

    // TEST_USER authors a course that OTHER_USER must never see.
    await loginViaUi(page, TEST_USER);
    const testUserCourse = `TEST_USER's list course ${Date.now()}`;
    await createCourseViaUi(page, {
      title: testUserCourse,
      description: "Authored by the first E2E user.",
    });
    await logoutViaUi(page);

    // OTHER_USER authors a course that TEST_USER must never see.
    await loginViaUi(page, OTHER_USER);
    const otherUserCourse = `OTHER_USER's list course ${Date.now()}`;
    await createCourseViaUi(page, {
      title: otherUserCourse,
      description: "Authored by the second E2E user.",
    });

    // Already on /courses after creating the course: OTHER_USER's list
    // shows their own course but not TEST_USER's.
    await expect(page).toHaveURL(/\/courses\/?$/);
    await expect(courseLink(page, otherUserCourse)).toBeVisible();
    await expect(courseLink(page, testUserCourse)).toHaveCount(0);
    await logoutViaUi(page);

    // And TEST_USER's list shows their own course but not OTHER_USER's.
    await loginViaUi(page, TEST_USER);
    await page.goto("/courses");
    await expect(courseLink(page, testUserCourse)).toBeVisible();
    await expect(courseLink(page, otherUserCourse)).toHaveCount(0);
  });

  for (const [itemType, seededTitles] of [
    // The plurals must match the link text the list page is expected to
    // render: "3 assignments" / "2 lessons" (see the assertions below).
    ["assignments", ["Some assignment 1", "Some assignment 2", "Some assignment 3"]],
    ["lessons", ["Some lesson 1", "Some lesson 2"]],
  ] as const) {
    test(`each course card links to its ${itemType} tab with a count`, async ({
      page,
    }) => {
      await loginViaUi(page, TEST_USER);

      // A course that uses no other test course's items: counts seeded
      // below are unambiguous from the freshly created course alone.
      const title = `Course with ${seededTitles.length} ${itemType} ${Date.now()}`;
      const coursePath = await createCourseViaUi(page, {
        title,
        description: `Course with ${seededTitles.length} ${itemType}.`,
      });
      const courseId = /\/courses\/(\d+)$/.exec(coursePath)![1];

      // Seed items directly in the e2e DB (faster and more robust than
      // walking the /assignments/new and /lessons/new forms).
      const seed = itemType === "assignments" ? seedAssignments : seedLessons;
      await seed(Number(courseId), [...seededTitles]);

      await page.goto("/courses");

      // Fails ATM: the list page has no such links yet (TDD red) —
      // href must follow the course detail tabs' ?tab= search param
      // (src/routes/_authenticated/courses/$courseId.tsx), and the link
      // text must include the number of items the course has.
      const itemLink = page.locator(
        `a[href="/courses/${courseId}?tab=${itemType}"]`,
      );
      await expect(itemLink).toBeVisible();
      await expect(itemLink).toHaveText(
        `${seededTitles.length} ${itemType}`,
      );

      // And the link actually leads to the right tab on the course page.
      await itemLink.click();
      await expect(page).toHaveURL(new RegExp(`tab=${itemType}`));
      await expect(
        page.getByRole("radio", { name: itemType === "assignments" ? "Assignments" : "Lessons" }),
      ).toBeChecked();
    });
  }
});
