import { expect, test, type Page } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  seedAssignments,
  seedCourse,
  seedEnrollment,
  seedQuestions,
} from "./helpers/db";
import { slowServerFnCalls } from "./helpers/server-fn";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #51: on /assignments/<id>, the author's [Add question] form must
// guard against double submission. While the form submits, the submit
// button disables and shows a loading animation. Only the course author
// may perform the action at all.

/**
 * Clicks the [Add question] button until the submit actually starts.
 *
 * Like createAssignmentViaUi (helpers/assignment.ts): in dev the first
 * click can race the module graph load and do nothing. The submit has
 * started once the page posts the createQuestion server fn call to
 * /_serverFn; that is the only POST /_serverFn request this page makes,
 * and it is implementation independent (it fires before issue #51's
 * pending UI exists).
 */
async function clickAddQuestionButton(page: Page) {
  const button = page.getByRole("button", { name: "Add question" });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const submitStarted = page
      .waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/_serverFn/"),
        { timeout: 2000 },
      )
      .catch(() => null);
    await button.click();
    if (await submitStarted) return;
    // The click raced hydration and did nothing; click again.
  }
  throw new Error(
    "clickAddQuestionButton: the submit never started after 3 attempts",
  );
}

test.describe("author adds a question to an assignment (issue #51)", () => {
  test("the Add question button is disabled while the form submits", async ({
    page,
  }) => {
    const title = `Pending add question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Add question button must disable on submit.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Pending add question assignment",
    ]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    const addQuestionButton = page.getByRole("button", { name: "Add question" });
    await addQuestionButton.scrollIntoViewIfNeeded();
    await page
      .locator('fieldset:has-text("Question") textarea')
      .fill("Pending double submit question");
    await page
      .locator('fieldset:has-text("Answer") textarea')
      .fill("Answer for the pending double submit question");
    await clickAddQuestionButton(page);

    // While the createQuestion server fn is in flight, the button must
    // not accept a second submission.
    await expect(addQuestionButton).toBeDisabled();
  });

  test("the Add question button shows a loading animation while the form submits", async ({
    page,
  }) => {
    const title = `Loading add question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Add question button shows a pending spinner.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Loading add question assignment",
    ]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    const addQuestionButton = page.getByRole("button", { name: "Add question" });
    await addQuestionButton.scrollIntoViewIfNeeded();
    await page
      .locator('fieldset:has-text("Question") textarea')
      .fill("Loading spinner question");
    await page
      .locator('fieldset:has-text("Answer") textarea')
      .fill("Answer for the loading spinner question");
    await clickAddQuestionButton(page);

    // Like the move buttons (issues #43 and #44), the pending button
    // shows the daisyUI loading spinner.
    await expect(addQuestionButton.locator(".loading")).toBeVisible();

    // The animation ends when the submission completes.
    await expect(addQuestionButton.locator(".loading")).toHaveCount(0);
  });

  test("the Add question button is enabled again after the submission completes", async ({
    page,
  }) => {
    const title = `Reenable add question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Add question button must come back after use.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Reenable add question assignment",
    ]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    const addQuestionButton = page.getByRole("button", { name: "Add question" });
    await addQuestionButton.scrollIntoViewIfNeeded();
    await page
      .locator('fieldset:has-text("Question") textarea')
      .fill("Reenabled button question");
    await page
      .locator('fieldset:has-text("Answer") textarea')
      .fill("Answer for the reenabled button question");
    await clickAddQuestionButton(page);

    // The guard is temporary: once the createQuestion server fn answers,
    // the button must be clickable again so the author can add the next
    // question without a page reload.
    await expect(addQuestionButton).toBeEnabled();

    // The submission itself worked: the loader data now holds the new
    // question, and the form no longer shows its old values.
    const listItem = page
      .locator("ul li")
      .filter({ hasText: "Reenabled button question" });
    await expect(listItem).toHaveCount(1);
    await expect(
      page.locator('fieldset:has-text("Question") textarea'),
    ).toHaveValue("");
  });

  test("a second click during the pending window does not create a duplicate question", async ({
    page,
  }) => {
    const title = `Duplicate add question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Add question form must submit once per click.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Duplicate add question assignment",
    ]);
    // One seeded question keeps the questions list non-empty, so the
    // count assertion cannot pass on an empty list by accident.
    await seedQuestions(assignmentId, ["Seeded question before the submit"]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    const addQuestionButton = page.getByRole("button", { name: "Add question" });
    await addQuestionButton.scrollIntoViewIfNeeded();
    await page
      .locator('fieldset:has-text("Question") textarea')
      .fill("Submitted exactly once question");
    await page
      .locator('fieldset:has-text("Answer") textarea')
      .fill("Answer for the submitted exactly once question");

    await clickAddQuestionButton(page);
    // The button must already be disabled here, so this forced click is
    // a no-op in the browser: Chromium does not deliver clicks on
    // disabled buttons.
    await addQuestionButton.click({ force: true });

    // Exactly one list entry holds the new question text.
    const listItem = page
      .locator("ul li")
      .filter({ hasText: "Submitted exactly once question" });
    await expect(listItem).toHaveCount(1);
  });

  test("only the course author can add a question", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Author only add question course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose questions a non-author must not add to.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Author only add question assignment",
    ]);
    await seedQuestions(assignmentId, ["Other author's seeded question"]);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);

    // The assignment detail page stays closed to non-authors: TEST_USER
    // gets the router's not-found page instead of the add-question form.
    await page.goto(`/assignments/${assignmentId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(page.getByText("Other author's seeded question")).toHaveCount(
      0,
    );

    // The student assignment page shows the questions to answer (as Q#
    // step links; the text itself lives on the question page), but the
    // [Add question] form is an author tool and must not render there.
    await page.goto(`/student/assignments/${assignmentId}`);
    await expect(page.getByText("Go to question #1")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add question" }),
    ).toHaveCount(0);
  });
});
