import { expect, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  expectRedirectedToLogin,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { OTHER_USER, TEST_USER } from "./test-user";

/**
 * Creates a course through the real /courses/new form and returns the path
 * of its detail page (e.g. "/courses/7").
 *
 * Selectors come from src/routes/_authenticated/courses/new.tsx: the form
 * wraps each TextField in a fieldset whose legend names the field (matching
 * by fieldset keeps out the navbar's unrelated "Search" input), and the
 * submit button is located by its accessible name.
 */
async function createCourseViaUi(
  page: Page,
  course: { title: string; description: string },
): Promise<string> {
  await page.goto("/courses/new");
  // Like loginViaUi: wait for hydration so the React submit handler
  // intercepts the click instead of a native GET form submit.
  await page.waitForLoadState("networkidle");
  await page.locator('fieldset:has-text("Title") input').fill(course.title);
  await page
    .locator('fieldset:has-text("Description") textarea')
    .fill(course.description);
  await page.getByRole("button", { name: "Add course" }).click();

  // On success the form navigates to the course list, where the new course
  // card is linked by its (unique) title.
  await page.waitForURL(/\/courses\/?$/);
  const courseLink = page.getByRole("link", { name: course.title });
  await expect(courseLink).toBeVisible();
  const href = await courseLink.getAttribute("href");
  expect(href, "link to the freshly created course").toMatch(
    /^\/courses\/\d+$/,
  );
  return href!;
}

test.describe("course detail page", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    // The id itself doesn't matter: the _authenticated layout's beforeLoad
    // redirect fires before any course loader runs.
    await expectRedirectedToLogin(page, "/courses/1");
  });

  test("author sees the Course Details and Enrollment tabs", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `Tabs course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Authored by the E2E test user.",
    });

    await page.goto(coursePath);
    await expect(page).toHaveURL(/\/courses\/\d+$/);
    // Let the route's loaders (and React hydration) settle before touching
    // the tabs: a tab click issued while the initial loaders are still
    // pending can be dropped by the router (no history push, UI/URL desync).
    await page.waitForLoadState("networkidle");

    // The page is a daisyUI tabs-border widget: two radio inputs render the
    // tab buttons, one tab-content div per tab.
    const courseDetailsTab = page.getByRole("radio", {
      name: "Course Details",
    });
    const enrollmentTab = page.getByRole("radio", { name: "Enrollment" });
    await expect(courseDetailsTab).toBeVisible();
    await expect(enrollmentTab).toBeVisible();

    // Course Details is defaultChecked and shows the course.
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();

    // Switching tabs reveals the Enrollment form. The tabs are
    // React-controlled radios backed by the ?tab= search param: use click()
    // plus asserting the resulting state, since check()'s native "did the
    // input stay checked" verification races the SPA re-render triggered by
    // every tab-switch navigation.
    await enrollmentTab.click();
    await expect(page).toHaveURL(/tab=enrollments/);
    await expect(enrollmentTab).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "Enroll a student" }),
    ).toBeVisible();

    // Switching back shows the course details again.
    await courseDetailsTab.click();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(courseDetailsTab).toBeChecked();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  });
  test("author sees the Assignments and Lessons tabs", async ({ page }) => {
    await loginViaUi(page);

    const title = `Lessons course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course for checking Assignments and Lessons tabs.",
    });

    await page.goto(coursePath);
    // Let the route's loaders (and React hydration) settle: a tab click
    // issued while the initial loaders are still pending can be dropped by
    // the router (no history push, UI/URL desync).
    await page.waitForLoadState("networkidle");

    // The author should get two more tabs in the tabs-border widget.
    const assignmentsTab = page.getByRole("radio", { name: "Assignments" });
    const lessonsTab = page.getByRole("radio", { name: "Lessons" });
    await expect(assignmentsTab).toBeVisible();
    await expect(lessonsTab).toBeVisible();

    // The tabs are React-controlled radios backed by the ?tab= search
    // param: click() plus asserting the resulting UI state, since check()'s
    // native "did the input stay checked" verification races the SPA
    // re-render triggered by every tab-switch navigation.
    await assignmentsTab.click();
    await expect(page).toHaveURL(/tab=assignments/);
    await expect(assignmentsTab).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "Assignments" }),
    ).toBeVisible();

    await lessonsTab.click();
    await expect(page).toHaveURL(/tab=lessons/);
    await expect(lessonsTab).toBeChecked();
    await expect(page.getByRole("heading", { name: "Lessons" })).toBeVisible();
  });

  test("non-author gets a 404 instead of the course page", async ({ page }) => {
    // Login as the second seeded user and author a course that TEST_USER
    // must never be able to see.
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page, OTHER_USER);
    const title = `Not TEST_USER's course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Authored by the second E2E user.",
    });
    await logoutViaUi(page);

    // The route loader (src/routes/_authenticated/courses/$courseId.tsx)
    // looks the course up by author; a logged-in user who is not the author
    // is thrown to the router's defaultNotFoundComponent.
    await loginViaUi(page, TEST_USER);
    await page.goto(coursePath);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Course Details" }),
    ).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Enrollment" })).toHaveCount(
      0,
    );
  });
});
