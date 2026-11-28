import { expect, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import {
  seedAssignments,
  seedCourseItems,
  seedEnrollment,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

/**
 * Creates a course authored by OTHER_USER with one seeded assignment holding
 * the given questions, and returns the course, assignment and question ids
 * (question ids in insertion / position order). The course is deliberately
 * NOT TEST_USER's: the only route to its student question page must be the
 * enrollment row. The question page lives at /student/assignments/
 * <assignment_id>/questions/<question_id>.
 *
 * The optional correctAnswers set each question's stored answer (the
 * model answer, seedQuestions' third argument). Existing callers that
 * omit it keep the generated default answers.
 */
async function createAssignmentWithQuestionsOwnedByOtherUser(
  page: Page,
  questionTexts: string[],
  correctAnswers?: string[],
) {
  await ensureSignedUp(OTHER_USER);
  await loginViaUi(page, OTHER_USER);
  const title = `Student question course ${Date.now()}`;
  const coursePath = await createCourseViaUi(page, {
    title,
    description: "Authored by the second E2E user.",
  });
  const courseId = Number(/\/courses\/(\d+)$/.exec(coursePath)![1]);
  const [assignmentId] = await seedAssignments(courseId, [
    "Question-page assignment",
  ]);
  // The student course page lists items by course_items.position (issue
  // #32), so the assignment needs an outline row for its card (and its
  // link) to show up there. The app's assignment create flow inserts one
  // (position = max + 1); the seeder mirrors that for the single item.
  await seedCourseItems(courseId, [
    { itemType: "assignment", itemId: assignmentId, position: 0 },
  ]);
  const questionIds = await seedQuestions(
    assignmentId,
    questionTexts,
    correctAnswers,
  );
  await logoutViaUi(page);
  return { courseId, assignmentId, questionIds };
}

test.describe("student assignment question page", () => {
  test("a non-enrolled student is blocked from the question page", async ({
    page,
  }) => {
    const { assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(page, [
        "Gate question",
      ]);

    await loginViaUi(page, TEST_USER);
    // Direct URL entry, like the sibling non-enrolled test on the assignment
    // page: the URL alone must not grant access.
    await page.goto(
      `/student/assignments/${assignmentId}/questions/${questionIds[0]}`,
    );

    // getStudentQuestion (src/server/questions/get-questions.ts) calls
    // requireUserEnrolledInCourse, whose check throws for non-enrolled
    // users, so the question content and its answer form are never
    // rendered — only the error card stays.
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toBeVisible();
    await expect(page.getByText("Gate question")).toHaveCount(0);
    // The answer fieldset (TextField renders input/textarea inside a
    // <fieldset>; the navbar Search input has no fieldset) must be gone too.
    // Scoped, because getByRole("textbox") also matches the navbar search.
    await expect(
      page.locator("form fieldset input, form fieldset textarea"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toHaveCount(0);
  });

  // When the submission is already submitted (submitted_at NOT NULL), the
  // question page must render the question and the saved answer as text,
  // without the answer entry form.
  test("a student whose submission is already submitted sees the question and answer as text, with no form", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(page, [
        "Read-only question",
        "Second question",
      ]);

    // A submitted submission (submitted_at NOT NULL) plus the student's
    // saved answer to question #1, like after the Okay confirmation.
    await seedSubmission(assignmentId, TEST_USER.email, Date.now());
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      questionIds[0],
      "My saved answer to the read-only question",
    );
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like loginViaUi/createCourseViaUi: wait for hydration so the
    // assignment link click is handled by React (client-side) instead of a
    // full page load.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Question-page assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );
    await page.getByRole("link", { name: "Go to question #1" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[0]}$`,
      ),
    );

    // The question itself stays visible... Scoped to the heading because
    // getByText("Read-only question") also substring-matches the saved answer
    // ("...to the read-only question"), which would violate strict mode.
    await expect(
      page.getByRole("heading", { name: "Read-only question" }),
    ).toBeVisible();
    // ...the saved answer is shown as text...
    await expect(
      page.getByText("My saved answer to the read-only question"),
    ).toBeVisible();
    // ...and the answer entry form is gone: no fieldset input/textarea, no
    // submit button. Scoped, because getByRole("textbox") also matches the
    // navbar search input.
    await expect(
      page.locator("form fieldset input, form fieldset textarea"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toHaveCount(0);
  });

  // Issue #92: a student is done submitting the assignment and goes
  // back to the question page. The answer form flashes briefly and is
  // then replaced by the static answer display. The form must not
  // show at all: the student can no longer submit answers.
  //
  // The read-only test above does not catch the flash. It asserts
  // only the final state, and its student never visited the question
  // page before. This test visits the page while the submission is in
  // progress first. That visit caches the question route loader with
  // isSubmitted = false. The later visit must not render the form
  // from the stale cached state while the loader runs again.
  //
  // Test-driven development red phase: no implementation change yet.
  test("the answer form never flashes when the student returns to the question page after submitting the assignment", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(page, [
        "Flash question",
      ]);

    // An in-progress submission: the student may still enter answers.
    await seedSubmission(assignmentId, TEST_USER.email);
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like the other tests: hydrate before the assignment link click.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Question-page assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );
    await page.getByRole("link", { name: "Go to question #1" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[0]}$`,
      ),
    );

    // While the submission is in progress, the form shows and the
    // student answers the question like a real user. This visit also
    // caches the question route with isSubmitted = false.
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toBeVisible();
    await page.locator("form fieldset input").fill("My final answer");
    await page.getByRole("button", { name: "Submit answer" }).click();
    // The only question has no next one: the form resets and the page
    // stays. Wait for the reset before navigating back.
    await expect(page.locator("form fieldset input")).toHaveValue("");

    // Submit the assignment through the confirmation modal, like the
    // plain flow in student-assignment-check-on-submit.spec.ts.
    await page.getByRole("link", { name: "Back to assignment" }).click();
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
    // The submission is submitted now: the route reloads and the
    // submit button disappears.
    await expect(submitButton).toHaveCount(0);

    // Record every appearance of the answer form during the
    // navigation back to the question page. A MutationObserver catches
    // even a one-frame flash. A poll after the click could miss it.
    await page.evaluate(() => {
      const w = window as unknown as { __answerFormSeen: boolean };
      w.__answerFormSeen = false;
      new MutationObserver(() => {
        if (
          document.querySelector("form fieldset input, form fieldset textarea")
        ) {
          w.__answerFormSeen = true;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    // The student goes back to the question page.
    await page.getByRole("link", { name: "Go to question #1" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[0]}$`,
      ),
    );

    // The question and the saved answer show as text...
    await expect(
      page.getByRole("heading", { name: "Flash question" }),
    ).toBeVisible();
    await expect(page.getByText("Your answer: My final answer")).toBeVisible();
    // ...the final state has no form (scoped like the tests above,
    // because getByRole("textbox") also matches the navbar search)...
    await expect(
      page.locator("form fieldset input, form fieldset textarea"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toHaveCount(0);
    // ...and the form never appeared during the navigation, not even
    // for one frame.
    expect(
      await page.evaluate(
        () => (window as unknown as { __answerFormSeen?: boolean })
          .__answerFormSeen,
      ),
    ).toBe(false);
  });

  test("a student with an in-progress submission sees the answer form", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(page, [
        "Open question",
        "Second question",
      ]);

    // An in-progress submission (submitted_at null): the student may still
    // enter answers.
    await seedSubmission(assignmentId, TEST_USER.email);
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like the other tests: hydrate before the assignment link click.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Question-page assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );
    await page.getByRole("link", { name: "Go to question #1" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionIds[0]}$`,
      ),
    );

    // The question text and the answer entry form show up. The TextField
    // legend is not a <label>, so the input has no accessible name; locate
    // the answer fieldset structurally instead (scoped to <fieldset> so the
    // navbar search input never matches).
    await expect(page.getByText("Open question")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toBeVisible();
    await expect(page.locator("form fieldset input")).toHaveCount(1);
  });
});

/**
 * Issue #104: after the student submitted the assignment, the question
 * page shows the question's correct answer.
 *
 * The contract (from the issue): on /student/assignments/<id>/questions/
 * <id>, when the student already submitted the assignment, the page
 * displays "Correct answer: <answer>" below the "Your answer..." text.
 * The issue conditions the line on the submitted assignment, not on a
 * saved answer, so a submitted student who skipped the question sees it
 * below "No answer submitted" too. While the submission is in progress,
 * the correct answer must not show anywhere on the page: the student
 * could copy it into the still-open answer form.
 *
 * Test-driven development red phase: the loader's question query
 * (dbGetQuestionByIdAndAssignment) does not fetch the answer column
 * today, so both submitted-state tests fail until the feature exists.
 * The in-progress test passes before and after: it pins the leak guard.
 */
test.describe("student question page correct answer (issue #104)", () => {
  const QUESTION = "Correct-answer question";
  const CORRECT_ANSWER = "The model answer: photosynthesis";
  const STUDENT_ANSWER = "My own answer to the question";

  /**
   * Seeds TEST_USER's enrollment and submission on the assignment and
   * walks to question #1 like a real student: course page → assignment
   * card → "Go to question #1". Returns nothing; the tests read their
   * seeded ids from the closure. Waits for the question page's own DOM
   * (the heading renders in both the form and the read-only branch), so
   * the caller's assertions never run against the stale overview DOM.
   */
  async function openFirstQuestionAsStudent(
    page: Page,
    courseId: number,
    assignmentId: number,
    questionId: number,
    submittedAt: number | null,
    studentAnswer: string | null,
  ) {
    await seedSubmission(assignmentId, TEST_USER.email, submittedAt);
    if (studentAnswer !== null) {
      await seedSubmissionAnswer(
        assignmentId,
        TEST_USER.email,
        questionId,
        studentAnswer,
      );
    }
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like the tests above: hydrate before the assignment link click.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Question-page assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );
    await page.getByRole("link", { name: "Go to question #1" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/student/assignments/${assignmentId}/questions/${questionId}$`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: QUESTION }),
    ).toBeVisible();
  }

  test("a submitted student sees the correct answer below the saved answer", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(
        page,
        [QUESTION],
        [CORRECT_ANSWER],
      );

    await openFirstQuestionAsStudent(
      page,
      courseId,
      assignmentId,
      questionIds[0]!,
      Date.now(),
      STUDENT_ANSWER,
    );

    // The saved answer shows as text (the read-only contract of the
    // sibling tests), scoped by the line prefix because the answer
    // text also substring-matches nothing else on the page.
    const yourAnswerLine = page.getByText(/^Your answer: /);
    await expect(yourAnswerLine).toBeVisible();
    await expect(yourAnswerLine).toContainText(STUDENT_ANSWER);

    // The issue #104 line: the correct answer below the saved answer.
    // The line prefix is unique on the page whether the label renders
    // as one text node (like "Your answer:") or as a bold span (like
    // the author review's AnswerCard): getByText matches the smallest
    // element holding the text, so strict mode stays safe either way.
    const correctAnswerLine = page.getByText(/^Correct answer: /);
    await expect(correctAnswerLine).toBeVisible();
    await expect(correctAnswerLine).toContainText(CORRECT_ANSWER);

    // "Below the 'Your answer...' text" (issue #104): the correct
    // answer line sits under the saved answer line.
    const yourAnswerBox = await yourAnswerLine.boundingBox();
    const correctAnswerBox = await correctAnswerLine.boundingBox();
    expect(yourAnswerBox).not.toBeNull();
    expect(correctAnswerBox).not.toBeNull();
    expect(correctAnswerBox!.y).toBeGreaterThan(yourAnswerBox!.y);
  });

  test("a submitted student who skipped the question still sees the correct answer", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(
        page,
        [QUESTION],
        [CORRECT_ANSWER],
      );

    // The submission is submitted but holds no saved answer for the
    // question, so the read-only branch renders "No answer submitted".
    await openFirstQuestionAsStudent(
      page,
      courseId,
      assignmentId,
      questionIds[0]!,
      Date.now(),
      null,
    );

    const noAnswerLine = page.getByText("No answer submitted");
    await expect(noAnswerLine).toBeVisible();

    // The issue conditions the correct answer on the submitted
    // assignment only, so it must show here too, below the answer
    // line.
    const correctAnswerLine = page.getByText(/^Correct answer: /);
    await expect(correctAnswerLine).toBeVisible();
    await expect(correctAnswerLine).toContainText(CORRECT_ANSWER);
    const noAnswerBox = await noAnswerLine.boundingBox();
    const correctAnswerBox = await correctAnswerLine.boundingBox();
    expect(noAnswerBox).not.toBeNull();
    expect(correctAnswerBox).not.toBeNull();
    expect(correctAnswerBox!.y).toBeGreaterThan(noAnswerBox!.y);
  });

  test("an in-progress submission shows no correct answer", async ({
    page,
  }) => {
    const { courseId, assignmentId, questionIds } =
      await createAssignmentWithQuestionsOwnedByOtherUser(
        page,
        [QUESTION],
        [CORRECT_ANSWER],
      );

    // The submission is in progress (submitted_at null): the student
    // may still enter an answer, so the page must not leak the
    // question's correct answer in any form.
    await openFirstQuestionAsStudent(
      page,
      courseId,
      assignmentId,
      questionIds[0]!,
      null,
      null,
    );

    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toBeVisible();
    await expect(page.getByText(/^Correct answer: /)).toHaveCount(0);
    await expect(page.getByText(CORRECT_ANSWER)).toHaveCount(0);
  });
});
