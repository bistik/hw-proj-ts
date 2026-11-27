import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import {
  getSubmissionRow,
  seedAssignments,
  seedCourseItems,
  seedEnrollment,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
  setAssignmentCheckOnSubmit,
} from "./helpers/db";
import { slowServerFnCalls } from "./helpers/server-fn";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #101: on /student/assignments/<id>/questions/<id>, a student
// who answered every question must be able to submit the assignment
// without walking back to the overview page. Acceptance items:
// 1. When all questions are answered, the question page shows the
//    option at the top of the answer form, with the copy suggested in
//    the issue ("All the questions in this assignment have been
//    answered. Do you want to submit the assignment?") and a "Submit
//    assignment" button.
// 2. The button opens the same confirmation modal as the overview
//    page's submit ("Submit this assignment?", Okay / Cancel).
// 3. Okay runs the same submitAssignment flow as the overview page:
//    a stored-on assignment auto-checks, shows the ScoreModal (score +
//    confetti) and Close returns to the course page — the same route
//    the overview page redirects to; a stored-off assignment just
//    marks the submission submitted.
// 4. The double submission guard matches the overview page too: while
//    the submit is in flight, the Okay button disables and shows the
//    daisyUI loading spinner (ConfirmModal owns that guard).
//
// Test-driven development red phase: the question page has no submit
// option today, so every test that needs the option fails until the
// feature exists. The unanswered-questions test pins the inverse
// contract and passes before and after: the option must not show
// while any question is still unanswered.

const ASSIGNMENT_TITLE = "Submit-from-question assignment";
const QUESTIONS = [
  "Submit-flow question one",
  "Submit-flow question two",
] as const;
const CORRECT_ANSWERS = ["Correct answer one", "Correct answer two"] as const;

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
    title: `Submit-from-question course ${Date.now()}`,
    description: "Authored by the second E2E user.",
  });
  const courseId = Number(/\/courses\/(\d+)$/.exec(coursePath)![1]);
  const [assignmentId] = await seedAssignments(courseId, [ASSIGNMENT_TITLE]);
  await setAssignmentCheckOnSubmit(assignmentId, checkOnSubmit);
  // The student course page lists items by course_items.position, so
  // the assignment needs an outline row for its link to show up there.
  await seedCourseItems(courseId, [
    { itemType: "assignment", itemId: assignmentId, position: 0 },
  ]);
  const questionIds = await seedQuestions(
    assignmentId,
    [...QUESTIONS],
    [...CORRECT_ANSWERS],
  );
  await logoutViaUi(page);
  return { courseId, assignmentId, questionIds };
}

/**
 * Seeds TEST_USER's enrollment and in-progress submission on the
 * assignment, with saved answers (the questions' correct answers, so
 * the stored-on auto-check scores full marks) for the first
 * `answeredCount` questions. Returns the submission id.
 */
async function seedStudentAnswers(
  courseId: number,
  assignmentId: number,
  questionIds: number[],
  answeredCount: number,
) {
  await seedEnrollment(TEST_USER.email, courseId);
  const submissionId = await seedSubmission(assignmentId, TEST_USER.email);
  for (let i = 0; i < answeredCount; i++) {
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      questionIds[i]!,
      CORRECT_ANSWERS[i]!,
    );
  }
  return submissionId;
}

/**
 * Logs TEST_USER in and walks to question #1 like a real student:
 * course page → assignment card → "Go to question #1". Waits for
 * hydration before the assignment link click, like the sibling question
 * page specs, so React handles the client-side navigations.
 */
async function openFirstQuestion(
  page: Page,
  courseId: number,
  assignmentId: number,
  questionId: number,
) {
  await loginViaUi(page, TEST_USER);
  await page.goto(`/student/courses/${courseId}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: ASSIGNMENT_TITLE }).click();
  await expect(page).toHaveURL(
    new RegExp(`/student/assignments/${assignmentId}$`),
  );
  await page.getByRole("link", { name: "Go to question #1" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/student/assignments/${assignmentId}/questions/${questionId}$`),
  );
  // Wait for the question page's own DOM before any further assertion.
  // With slowed server fn calls (the double submission guard test),
  // the URL moves to the question route before its loader commits, and
  // the stale overview DOM — which holds its own "Submit assignment"
  // button and confirmation modal — stays interactive during that
  // window. Without this wait, the tests could click the overview's
  // submit UI while the URL already says "questions".
  await expect(
    page.getByRole("button", { name: "Submit answer" }),
  ).toBeVisible();
}

/**
 * Clicks the question page's "Submit assignment" button until the
 * confirmation modal opens, and returns the modal locator. Like the
 * overview page specs: hydration in dev can lag the SSR-rendered
 * button, so a click that falls through does nothing and the test
 * must retry until the modal is open.
 */
async function openSubmitConfirmModal(page: Page) {
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
  return confirmModal;
}

/**
 * Clicks the modal's Okay button until the submission actually starts.
 *
 * Like clickGradeButton (author-grade-answer-double-submit.spec.ts):
 * in dev the first click can race the module graph load and do
 * nothing. The submission has started once the page posts the
 * submitAssignment server fn call to /_serverFn. That POST is
 * implementation independent (it fires before any pending UI could
 * exist), and this page makes no other POST server fn call: the
 * loader and its invalidation use GET, and login posts to /api/auth.
 */
async function clickOkayUntilSubmitStarts(page: Page, okayButton: Locator) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const submitStarted = page
      .waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes("/_serverFn/"),
        { timeout: 2000 },
      )
      .catch(() => null);
    await okayButton.click();
    if (await submitStarted) return;
    // The click raced hydration and did nothing; click again.
  }
  throw new Error(
    "clickOkayUntilSubmitStarts: the submission never started after 3 attempts",
  );
}

test.describe("student question page submit assignment (issue #101)", () => {
  test("shows the submit option at the top of the answer form when all questions are answered", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, false);
    await seedStudentAnswers(courseId, assignmentId, questionIds, 2);
    await openFirstQuestion(page, courseId, assignmentId, questionIds[0]!);

    // The answer form still renders (the submission is in progress)...
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toBeVisible();

    // ...and above it the issue #101 option: the issue's copy plus the
    // "Submit assignment" button.
    const banner = page.getByText(
      /All the questions in this assignment have been answered/,
    );
    await expect(banner).toBeVisible();
    await expect(
      page.getByText(/Do you want to submit the assignment\?/),
    ).toBeVisible();
    const submitButton = page.getByRole("button", {
      name: "Submit assignment",
    });
    await expect(submitButton).toBeVisible();

    // "Display this at the top of the question form" (issue #101): the
    // banner renders above the answer form, not below or inside the
    // submit row. The answer form is the only form with a fieldset
    // (the navbar search has none).
    const bannerBox = await banner.boundingBox();
    const answerForm = page
      .locator("form")
      .filter({ has: page.locator("fieldset") });
    const formBox = await answerForm.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(bannerBox!.y).toBeLessThan(formBox!.y);
  });

  test("does not show the submit option while at least one question is unanswered", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, false);
    // Only question #1 has a saved answer. Open question #1 anyway: the
    // option must depend on every question of the assignment, not on
    // the question currently on screen.
    await seedStudentAnswers(courseId, assignmentId, questionIds, 1);
    await openFirstQuestion(page, courseId, assignmentId, questionIds[0]!);

    // The page renders normally: the question and its answer form.
    await expect(
      page.getByRole("heading", { name: QUESTIONS[0]! }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toBeVisible();

    // But the issue #101 option must not show: question #2 has no
    // saved answer yet.
    await expect(
      page.getByText(/All the questions in this assignment have been answered/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit assignment" }),
    ).toHaveCount(0);
  });

  test("clicking 'Submit assignment' opens the confirmation modal, and Cancel closes it without submitting", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, false);
    const submissionId = await seedStudentAnswers(
      courseId,
      assignmentId,
      questionIds,
      2,
    );
    await openFirstQuestion(page, courseId, assignmentId, questionIds[0]!);

    // The same confirmation modal as the overview page's submit.
    const confirmModal = await openSubmitConfirmModal(page);
    await expect(
      confirmModal.getByRole("button", { name: "Okay" }),
    ).toBeVisible();
    await expect(
      confirmModal.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();

    // Cancel must not submit: the modal closes, the submission stays
    // in progress, and the option remains for a second try.
    await confirmModal.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmModal).not.toBeVisible();
    const row = await getSubmissionRow(submissionId);
    expect(row?.submitted_at).toBe(null);
    await expect(
      page.getByRole("button", { name: "Submit assignment" }),
    ).toBeVisible();
  });

  test("submitting a stored-on assignment shows the score modal with confetti and returns to the course page", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, true);
    // Both saved answers equal the questions' correct answers, so the
    // auto-check scores 2/2.
    await seedStudentAnswers(courseId, assignmentId, questionIds, 2);
    await openFirstQuestion(page, courseId, assignmentId, questionIds[0]!);

    const confirmModal = await openSubmitConfirmModal(page);
    await confirmModal.getByRole("button", { name: "Okay" }).click();

    // The same ScoreModal contract as the overview page (issue #95,
    // student-assignment-check-on-submit.spec.ts): an open daisyUI
    // dialog rendering the score, with the confetti showing together.
    // The hasText filter keeps the confirmation dialog (still open
    // while the submit is in flight) out of the match.
    const scoreModal = page
      .locator("dialog.modal[open]")
      .filter({ hasText: "Your score" });
    await expect(scoreModal).toBeVisible();
    await expect(scoreModal.getByText("Your score: 2/2")).toBeVisible();
    await expect(page.getByTestId("confetti")).toBeVisible();

    // Closing the modal returns to the same route the overview page
    // redirects to after submission: the student's course page.
    await scoreModal.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(new RegExp(`/student/courses/${courseId}$`));
    await expect(scoreModal).toHaveCount(0);
  });

  test("a stored-off assignment keeps the plain submit flow: no score modal, no confetti, and the page stays", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, false);
    const submissionId = await seedStudentAnswers(
      courseId,
      assignmentId,
      questionIds,
      2,
    );
    await openFirstQuestion(page, courseId, assignmentId, questionIds[0]!);

    const confirmModal = await openSubmitConfirmModal(page);
    await confirmModal.getByRole("button", { name: "Okay" }).click();

    // The plain flow matches the overview page: the submission is
    // marked submitted, the route reloads, the option disappears, and
    // the page stays put (the overview's plain flow does not redirect
    // either).
    await expect(
      page.getByRole("button", { name: "Submit assignment" }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[0]}$`,
      ),
    );

    // No score modal, no confetti, and the submission is submitted.
    await expect(page.getByText(/Your score:/)).toHaveCount(0);
    await expect(page.getByTestId("confetti")).toHaveCount(0);
    const row = await getSubmissionRow(submissionId);
    expect(row?.submitted_at).not.toBe(null);
  });

  test("the Okay button disables with a loading spinner while the submit is in flight, and a second click sends no second request", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createCourseWithToggledAssignment(page, false);
    await seedStudentAnswers(courseId, assignmentId, questionIds, 2);
    // Widen the in-flight window so the pending state is observable
    // deterministically. Install it before the login: login posts to
    // /api/auth, not /_serverFn, so it is not slowed down.
    await slowServerFnCalls(page);
    await openFirstQuestion(page, courseId, assignmentId, questionIds[0]!);

    // Count the submit POSTs. This page posts only the submitAssignment
    // server fn (the loader and its invalidation use GET, login posts
    // to /api/auth), so the count equals the submit actions.
    let submitRequests = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/_serverFn/")
      ) {
        submitRequests += 1;
      }
    });

    const confirmModal = await openSubmitConfirmModal(page);
    const okayButton = confirmModal.getByRole("button", { name: "Okay" });
    await clickOkayUntilSubmitStarts(page, okayButton);

    // The double submission guard: while the submitAssignment server fn
    // is in flight, the Okay button must not accept a second click and
    // shows the daisyUI spinner for user feedback.
    await expect(okayButton).toBeDisabled();
    await expect(okayButton.locator(".loading")).toBeVisible();

    // This forced click must be a no-op: Chromium does not deliver
    // clicks on disabled buttons.
    await okayButton.click({ force: true });

    // The submit completed exactly once: the route reloads and the
    // option disappears.
    await expect(
      page.getByRole("button", { name: "Submit assignment" }),
    ).toHaveCount(0);
    expect(submitRequests).toBe(1);
  });
});
