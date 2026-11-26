import { expect, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import {
  getAnswerIsCorrect,
  seedAssignments,
  seedCourseItems,
  seedEnrollment,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
  setAssignmentCheckOnSubmit,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #95: the student's submit flow auto-checks the submission when
// the assignment's check_on_submit is on. Acceptance items:
// 1. On submit assignment, each saved answer is checked automatically
//    against the question's correct answer (the grade is stored on the
//    submission_answers row, so the author's review sees it too).
// 2. A modal shows the student's score as Score/Total.
// 3. A confetti shows together with the modal.
// 4. Closing the modal returns the student to the course page.
//
// The issue does not fix the display texts. This spec fixes the
// contract: the score modal is an open daisyUI dialog (dialog.modal
// with the open attribute, like ConfirmModal) that renders
// "Your score: <correct>/<total>", the confetti is an element with
// data-testid="confetti" visible while the modal is open, and the
// modal's single action is a "Close" button that navigates to
// /student/courses/<course_id>.
//
// Test-driven development red phase: the submit flow only marks the
// submission submitted today, so the auto-check test fails until the
// feature exists. The stored-off test pins the plain flow and passes
// before and after the feature: the auto-check must not leak into
// assignments with the toggle off.

const ASSIGNMENT_TITLE = "Auto-check on submit assignment";

/**
 * Creates a course authored by OTHER_USER with one seeded assignment
 * whose check_on_submit toggle is set as given, holding two questions
 * with known correct answers. Returns the course, assignment and
 * question ids. The course is deliberately NOT TEST_USER's: the only
 * route to its student pages must be the enrollment row.
 */
async function createCourseWithToggledAssignment(
  page: Page,
  checkOnSubmit: boolean,
) {
  await ensureSignedUp(OTHER_USER);
  await loginViaUi(page, OTHER_USER);
  const coursePath = await createCourseViaUi(page, {
    title: `Auto-check submit course ${Date.now()}`,
    description: "Authored by the second E2E user.",
  });
  const courseId = Number(/\/courses\/(\d+)$/.exec(coursePath)![1]);
  const [assignmentId] = await seedAssignments(courseId, [
    ASSIGNMENT_TITLE,
  ]);
  await setAssignmentCheckOnSubmit(assignmentId, checkOnSubmit);
  // The student course page lists items by course_items.position, so
  // the assignment needs an outline row for its link to show up there.
  await seedCourseItems(courseId, [
    { itemType: "assignment", itemId: assignmentId, position: 0 },
  ]);
  const questionIds = await seedQuestions(
    assignmentId,
    ["Auto-check question one", "Auto-check question two"],
    ["Correct answer one", "Correct answer two"],
  );
  await logoutViaUi(page);
  return { courseId, assignmentId, questionIds };
}

test.describe("student assignment check on submit (issue #95)", () => {
  test("submitting a stored-on assignment auto-checks the answers, shows the score modal with confetti, and returns to the course page", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, true);
    // An in-progress submission, like a student who already opened
    // question #1. The id is needed to read the auto-check grades.
    const submissionId = await seedSubmission(assignmentId, TEST_USER.email);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like loginViaUi/createCourseViaUi: wait for hydration so the
    // assignment link click is handled by React (client-side).
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: ASSIGNMENT_TITLE }).click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    // Answer question #1 exactly like the question's correct answer...
    await page.getByRole("link", { name: "Go to question #1" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[0]}$`,
      ),
    );
    await page.locator("form fieldset input").fill("Correct answer one");
    await page.getByRole("button", { name: "Submit answer" }).click();
    // ...then question #2 (the last one) with a wrong answer.
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[1]}$`,
      ),
    );
    await page.locator("form fieldset input").fill("A wrong answer");
    await page.getByRole("button", { name: "Submit answer" }).click();
    // The last question has no next one: the form resets and the page
    // stays. Wait for the reset, so the answer is safely stored before
    // the navigation back.
    await expect(page.locator("form fieldset input")).toHaveValue("");

    await page.getByRole("link", { name: "Back to assignment" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );
    await expect(
      page.getByText(/2 of 2 questions have been answered/),
    ).toBeVisible();

    // Submit through the confirmation modal, like the plain flow.
    const submitButton = page.getByRole("button", {
      name: "Submit assignment",
    });
    await expect(submitButton).toBeVisible();
    const confirmModal = page
      .locator("dialog.modal")
      .filter({ hasText: "Submit this assignment?" });
    // Hydration in dev can lag the SSR-rendered button; a click that
    // falls through does nothing (loginViaUi documents the same race),
    // so retry until the confirmation modal is open.
    await expect
      .poll(
        async () => {
          await submitButton.click();
          return confirmModal.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    await confirmModal.getByRole("button", { name: "Okay" }).click();

    // The score modal: an open daisyUI dialog rendering the score.
    // The hasText filter keeps the confirmation dialog (still open
    // while the submit is in flight) out of the match.
    const scoreModal = page
      .locator("dialog.modal[open]")
      .filter({ hasText: "Your score" });
    await expect(scoreModal).toBeVisible();
    await expect(scoreModal.getByText("Your score: 1/2")).toBeVisible();

    // The confetti shows together with the modal.
    await expect(page.getByTestId("confetti")).toBeVisible();

    // The auto-check graded both saved answers in the database, so the
    // author's review page will see the same grades.
    expect(await getAnswerIsCorrect(questionIds[0], submissionId)).toBe(true);
    expect(await getAnswerIsCorrect(questionIds[1], submissionId)).toBe(false);

    // Closing the modal returns the student to the course page.
    await scoreModal.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/student/courses/${courseId}$`),
    );
    await expect(scoreModal).toHaveCount(0);
  });

  test("a stored-off assignment keeps the plain submit flow: no score modal, no confetti, no grading", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, false);
    const submissionId = await seedSubmission(assignmentId, TEST_USER.email);
    // One saved answer whose grade must stay null: the auto-check must
    // not leak into a stored-off assignment.
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      questionIds[0],
      "Correct answer one",
    );
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: ASSIGNMENT_TITLE }).click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    const submitButton = page.getByRole("button", {
      name: "Submit assignment",
    });
    await expect(submitButton).toBeVisible();
    const confirmModal = page
      .locator("dialog.modal")
      .filter({ hasText: "Submit this assignment?" });
    await expect
      .poll(
        async () => {
          await submitButton.click();
          return confirmModal.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    await confirmModal.getByRole("button", { name: "Okay" }).click();

    // The plain flow: the submission is marked submitted, the route
    // reloads, and the button disappears. The page stays put.
    await expect(submitButton).not.toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    // No score modal, no confetti...
    await expect(page.getByText(/Your score:/)).toHaveCount(0);
    await expect(page.getByTestId("confetti")).toHaveCount(0);
    // ...and the saved answer stays ungraded.
    expect(await getAnswerIsCorrect(questionIds[0], submissionId)).toBe(null);
  });
});
