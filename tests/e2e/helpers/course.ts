import { expect, type Page } from "@playwright/test";

/**
 * Creates a course through the real /courses/new form and returns the path
 * of its detail page (e.g. "/courses/7").
 *
 * Selectors come from src/routes/_authenticated/courses/new.tsx: the form
 * wraps each TextField in a fieldset whose legend names the field (matching
 * by fieldset keeps out the navbar's unrelated "Search" input), and the
 * submit button is located by its accessible name.
 */
export async function createCourseViaUi(
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
