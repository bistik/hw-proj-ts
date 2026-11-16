import { expect, type Page } from "@playwright/test";

/**
 * Creates an assignment through the real /courses/<courseId>/assignments/
 * new form.
 *
 * Selectors come from src/routes/_authenticated/courses/$courseId/
 * assignments/new.tsx: each TextField renders a fieldset whose legend names
 * the field (matching by fieldset keeps out the navbar's unrelated "Search"
 * input), and the submit button is located by its accessible name.
 */
export async function createAssignmentViaUi(
  page: Page,
  courseId: number,
  assignment: { title: string; example: string },
) {
  await page.goto(`/courses/${courseId}/assignments/new`);
  // Like loginViaUi: wait for hydration so the React submit handler
  // intercepts the click instead of a native form submit.
  await page.waitForLoadState("networkidle");
  await page.locator('fieldset:has-text("Title") input').fill(assignment.title);
  await page
    .locator('fieldset:has-text("Example") textarea')
    .fill(assignment.example);

  // Like loginViaUi: in dev the first click can race the module graph load
  // and do nothing (no navigation, no error); a later click submits.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole("button", { name: "Save Assignment" }).click();
    try {
      // On success the form navigates to the course detail page,
      // assignments tab. A failure leaves the page on the form with the
      // FormErrorAlert, so a broken submit is reported here instead of at
      // a later, unrelated assertion.
      await page.waitForURL(
        new RegExp(`/courses/${courseId}\\?tab=assignments$`),
        { timeout: 10_000 },
      );
      await expect(
        page
          .locator(".alert")
          .filter({ hasText: "Could not create the assignment" }),
      ).toHaveCount(0);
      return;
    } catch {
      // Retry: the click may have raced hydration and done nothing.
    }
  }
  throw new Error(
    `createAssignmentViaUi: form did not navigate to /courses/${courseId}?tab=assignments after 3 attempts`,
  );
}
