import { expect, type Page } from "@playwright/test";

/**
 * Creates a lesson through the real /courses/<courseId>/lessons/new form.
 *
 * Selectors come from src/routes/_authenticated/courses/$courseId/lessons/
 * new.tsx: each TextField renders a fieldset whose legend names the field
 * (matching by fieldset keeps out the navbar's unrelated "Search" input),
 * and the submit button is located by its accessible name.
 */
export async function createLessonViaUi(
  page: Page,
  courseId: number,
  lesson: { title: string; content: string },
) {
  await page.goto(`/courses/${courseId}/lessons/new`);
  // Like loginViaUi: wait for hydration so the React submit handler
  // intercepts the click instead of a native form submit.
  await page.waitForLoadState("networkidle");
  await page.locator('fieldset:has-text("Title") input').fill(lesson.title);
  await page
    .locator('fieldset:has-text("Content") textarea')
    .fill(lesson.content);

  // Like loginViaUi: in dev the first click can race the module graph load
  // and do nothing (no navigation, no error); a later click submits.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole("button", { name: "Save Lesson" }).click();
    try {
      // On success the form navigates to the course detail page, lessons
      // tab. A failure leaves the page on the form with the
      // FormErrorAlert, so a broken submit is reported here instead of at
      // a later, unrelated assertion.
      await page.waitForURL(
        new RegExp(`/courses/${courseId}\\?tab=lessons$`),
        { timeout: 10_000 },
      );
      await expect(
        page
          .locator(".alert")
          .filter({ hasText: "Could not create the lesson" }),
      ).toHaveCount(0);
      return;
    } catch {
      // Retry: the click may have raced hydration and done nothing.
    }
  }
  throw new Error(
    `createLessonViaUi: form did not navigate to /courses/${courseId}?tab=lessons after 3 attempts`,
  );
}
