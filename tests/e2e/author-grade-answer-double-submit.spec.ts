import { expect, test, type Locator, type Page } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  seedAssignments,
  seedCourse,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
} from "./helpers/db";
import { slowServerFnCalls } from "./helpers/server-fn";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #93: on /courses/<id>/assignments/<id>/submissions/<id>, the
// [Correct] and [Mistake] buttons must guard against double submission.
// While the grading server fn call is in flight, both buttons disable and
// the clicked button shows a loading animation.

/** The question texts and the student answers seeded for every test. */
const QUESTIONS = ["What is 2+2?", "Name a color."] as const;
const STUDENT_ANSWERS = ["Four", "Blue"] as const;
// The correct answers differ from the student answers, so every text
// assertion matches exactly one element.
const CORRECT_ANSWERS = ["4", "Red"] as const;

/**
 * Seeds one submitted review page target: a course by OTHER_USER, one
 * assignment, two questions with answers, and a submitted submission by
 * TEST_USER (the student is deliberately not the author) with both
 * answers saved. Returns the ids for the review URL:
 * /courses/<course_id>/assignments/<assignment_id>/submissions/<submission_id>.
 */
async function setupSubmittedReview() {
  await ensureSignedUp(OTHER_USER);
  const courseId = await seedCourse(OTHER_USER.email, {
    title: `Grading double submit course ${Date.now()}`,
    description: "Course whose grading buttons must disable on click.",
  });
  const [assignmentId] = await seedAssignments(courseId, [
    "Grading double submit assignment",
  ]);
  const questionIds = await seedQuestions(
    assignmentId,
    [...QUESTIONS],
    [...CORRECT_ANSWERS],
  );
  const submissionId = await seedSubmission(
    assignmentId,
    TEST_USER.email,
    Date.now(),
  );
  for (let i = 0; i < questionIds.length; i++) {
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      questionIds[i]!,
      STUDENT_ANSWERS[i]!,
    );
  }
  return { courseId, assignmentId, submissionId };
}

function reviewPath(
  courseId: number,
  assignmentId: number,
  submissionId: number,
) {
  return `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}`;
}

/**
 * Clicks a grading button until the grading actually starts.
 *
 * Like clickAddQuestionButton (author-add-question-double-submit.spec.ts):
 * in dev the first click can race the module graph load and do nothing.
 * The grading has started once the page posts the gradeSubmissionAnswer
 * server fn call to /_serverFn. That POST is implementation independent
 * (it fires before issue #93's pending UI exists), and this page makes no
 * other POST server fn call: the loader and its invalidation use GET.
 */
async function clickGradeButton(page: Page, button: Locator) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const gradingStarted = page
      .waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/_serverFn/"),
        { timeout: 2000 },
      )
      .catch(() => null);
    await button.click();
    if (await gradingStarted) return;
    // The click raced hydration and did nothing; click again.
  }
  throw new Error(
    "clickGradeButton: the grading never started after 3 attempts",
  );
}

test.describe("author grades an answer (issue #93)", () => {
  test("clicking Correct disables both grading buttons of that answer card", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmittedReview();

    await slowServerFnCalls(page);
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));
    await page.waitForLoadState("networkidle");

    const card = page.locator(".card").filter({ hasText: QUESTIONS[0]! });
    const correctButton = card.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    const mistakeButton = card.getByRole("button", {
      name: "Mistake",
      exact: true,
    });
    await clickGradeButton(page, correctButton);

    // While the gradeSubmissionAnswer server fn is in flight, the clicked
    // button must not accept a second submission.
    await expect(correctButton).toBeDisabled();

    // The sibling action on the same answer must not fire either: issue
    // #93 lists both buttons, so both disable on the click.
    await expect(mistakeButton).toBeDisabled();
  });

  test("the clicked Correct button shows a loading animation until the grading completes", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmittedReview();

    await slowServerFnCalls(page);
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));
    await page.waitForLoadState("networkidle");

    const card = page.locator(".card").filter({ hasText: QUESTIONS[0]! });
    const correctButton = card.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    await clickGradeButton(page, correctButton);

    // Like the move buttons (issues #43 and #44) and the Add question
    // button (issue #51), the pending button shows the daisyUI spinner.
    await expect(correctButton.locator(".loading")).toBeVisible();

    // The grading completed: the card shows the Correct mark, and the
    // summary score counts the answer.
    await expect(card.getByText("✓")).toBeVisible();
    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    await expect(summaryCard.getByText("1 of 2")).toBeVisible();

    // The animation ends with the grading.
    await expect(correctButton.locator(".loading")).toHaveCount(0);
  });

  test("clicking Mistake disables both grading buttons and shows the loading animation on the clicked button", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmittedReview();

    await slowServerFnCalls(page);
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));
    await page.waitForLoadState("networkidle");

    const card = page.locator(".card").filter({ hasText: QUESTIONS[0]! });
    const correctButton = card.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    const mistakeButton = card.getByRole("button", {
      name: "Mistake",
      exact: true,
    });
    await clickGradeButton(page, mistakeButton);

    // Both buttons of the answer card disable, and the clicked one gives
    // the click feedback: issue #93 applies to both actions.
    await expect(mistakeButton).toBeDisabled();
    await expect(correctButton).toBeDisabled();
    await expect(mistakeButton.locator(".loading")).toBeVisible();
  });

  test("the grading buttons are enabled again after the grading completes", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmittedReview();

    await slowServerFnCalls(page);
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));
    await page.waitForLoadState("networkidle");

    const card = page.locator(".card").filter({ hasText: QUESTIONS[0]! });
    const correctButton = card.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    const mistakeButton = card.getByRole("button", {
      name: "Mistake",
      exact: true,
    });
    await clickGradeButton(page, correctButton);

    // The guard is temporary: once the grading completes (the mark shows),
    // the author must grade the next answer without a page reload.
    await expect(card.getByText("✓")).toBeVisible();
    await expect(correctButton).toBeEnabled();
    await expect(mistakeButton).toBeEnabled();
  });

  test("a second click during the pending window does not send a second grading request", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmittedReview();

    await slowServerFnCalls(page);
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));
    await page.waitForLoadState("networkidle");

    // Count the grading POSTs. This page posts only the grading server
    // fn; the loader and its invalidation use GET server fn calls, and
    // login posts to /api/auth. So the count equals the grading actions.
    let gradingRequests = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/_serverFn/")
      ) {
        gradingRequests += 1;
      }
    });

    const card = page.locator(".card").filter({ hasText: QUESTIONS[0]! });
    const correctButton = card.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    await clickGradeButton(page, correctButton);

    // The button must already be disabled here, so this forced click must
    // be a no-op: Chromium does not deliver clicks on disabled buttons.
    await correctButton.click({ force: true });

    // The grading completed exactly once: one Correct mark, one score.
    await expect(card.getByText("✓")).toBeVisible();
    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    await expect(summaryCard.getByText("1 of 2")).toBeVisible();
    expect(gradingRequests).toBe(1);
  });
});
