import { expect, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  expectRedirectedToLogin,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import {
  seedAssignments,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

/** The question texts and the student answers seeded for every test. */
const QUESTIONS = ["What is 2+2?", "Name a color."] as const;
const STUDENT_ANSWERS = ["Four", "Blue"] as const;
// The correct answers come from the questions table. They differ from the
// student's answers so every text assertion matches exactly one element.
const CORRECT_ANSWERS = ["4", "Red"] as const;

/**
 * Creates a course authored by OTHER_USER with one seeded assignment, then
 * seeds a student submission by TEST_USER (the student is deliberately not
 * the author) and returns the ids needed to build the review page URL:
 * /courses/<course_id>/assignments/<assignment_id>/submissions/<submission_id>.
 *
 * Pass submitted: false to seed an in-progress submission (submitted_at
 * null) instead of a submitted one.
 *
 * answeredCount limits how many of the seeded questions get a
 * submission_answers row. The rest stay unanswered (student answer null),
 * which the review page must not offer grading actions for.
 */
async function setupSubmissionForReview(
  page: Page,
  {
    submitted,
    answeredCount = STUDENT_ANSWERS.length,
  }: { submitted: boolean; answeredCount?: number },
) {
  await ensureSignedUp(OTHER_USER);
  await loginViaUi(page, OTHER_USER);
  const title = `Submission review course ${Date.now()}`;
  const coursePath = await createCourseViaUi(page, {
    title,
    description: "Authored by the second E2E user.",
  });
  const courseId = Number(/\/courses\/(\d+)$/.exec(coursePath)![1]);
  // Seed directly in the e2e DB: the review page is new, so no author UI
  // path links to a submission's review URL yet — the direct URL visit is
  // the path this test guards.
  const [assignmentId] = await seedAssignments(courseId, [
    "Submission review assignment",
  ]);
  await logoutViaUi(page);

  const questionIds = await seedQuestions(
    assignmentId,
    [...QUESTIONS],
    [...CORRECT_ANSWERS],
  );
  const submissionId = await seedSubmission(
    assignmentId,
    TEST_USER.email,
    submitted ? Date.now() : null,
  );
  for (let i = 0; i < answeredCount && i < questionIds.length; i++) {
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      questionIds[i]!,
      STUDENT_ANSWERS[i]!,
    );
  }
  return { courseId, assignmentId, submissionId };
}

function reviewPath(courseId: number, assignmentId: number, submissionId: number) {
  return `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}`;
}

test.describe("author submission review page", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    // The ids themselves don't matter: the _authenticated layout's
    // beforeLoad redirect fires before the review route's loader runs.
    await expectRedirectedToLogin(
      page,
      "/courses/1/assignments/1/submissions/1",
    );
  });

  test("the course author sees one card per question with the student answer, in question order", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    // One card per question. Each card names the question (its heading),
    // shows that question's student answer, and offers the two grading
    // actions.
    for (let i = 0; i < QUESTIONS.length; i++) {
      await expect(
        page.getByRole("heading", {
          name: `Question #${i + 1}`,
          exact: true,
        }),
      ).toBeVisible();

      // The question text identifies the card uniquely (questions are
      // seeded with distinct texts).
      const card = page.locator(".card").filter({ hasText: QUESTIONS[i]! });
      await expect(card.getByText(STUDENT_ANSWERS[i]!)).toBeVisible();
      // The correct answer (the question's `answer` column) must render
      // below the student's answer, inside the same card.
      await expect(card.getByText(CORRECT_ANSWERS[i]!)).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Correct", exact: true }),
      ).toHaveCount(1);
      await expect(
        card.getByRole("button", { name: "Mistake", exact: true }),
      ).toHaveCount(1);
    }

    // Question order: the card for Question #1 sits above Question #2's
    // card (positions match the questions' seeded positions 0..n-1).
    const card1 = page
      .locator(".card")
      .filter({ hasText: STUDENT_ANSWERS[0]! });
    const card2 = page
      .locator(".card")
      .filter({ hasText: STUDENT_ANSWERS[1]! });
    const box1 = await card1.boundingBox();
    const box2 = await card2.boundingBox();
    expect(box1!.y).toBeLessThan(box2!.y);
  });

  test("the author sees a summary card above the answer cards", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    // The summary card identifies the submission: the student's name and
    // email, when the student started, and the current score.
    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard.getByText(TEST_USER.name)).toBeVisible();
    await expect(summaryCard.getByText(/Started/)).toBeVisible();
    // A date-like value. Requiring the year keeps this check from matching
    // the score text ("0 of 2"), which also contains digits.
    await expect(summaryCard.getByText(/\d{4}/)).toBeVisible();

    // Nothing is graded yet: the score counts zero of the two questions.
    // The "<correct> of <total>" format is part of the contract.
    await expect(summaryCard.getByText("0 of 2")).toBeVisible();

    // The summary sits above the first answer card, with no overlap.
    const summaryBox = await summaryCard.boundingBox();
    const firstCard = page.locator(".card").filter({ hasText: QUESTIONS[0]! });
    const firstBox = await firstCard.boundingBox();
    expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(firstBox!.y);
  });

  test("grading an answer updates its card mark and the summary score", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    const cards = QUESTIONS.map((question) =>
      page.locator(".card").filter({ hasText: question }),
    );

    // Initial state: every card's top-right mark is blank — no ✓ or ✗
    // renders anywhere in the answer cards.
    for (const card of cards) {
      await expect(card.getByText("✓")).toHaveCount(0);
      await expect(card.getByText("✗")).toHaveCount(0);
    }
    await expect(summaryCard.getByText("0 of 2")).toBeVisible();

    // Clicking "Correct" on the first card marks that card ✓. Hydration in
    // dev can lag the SSR-rendered button (a click that falls through does
    // nothing — loginViaUi documents the same race), so retry the click
    // until the mark appears.
    const correctButton = cards[0]!.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    const card1Mark = cards[0]!.getByText("✓");
    await expect
      .poll(
        async () => {
          await correctButton.click();
          return card1Mark.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // The mark sits at the card's top-right, on the question heading's
    // row: same row as the heading, to its right, inside the card.
    const heading = cards[0]!.getByRole("heading", {
      name: "Question #1",
      exact: true,
    });
    const markBox = await card1Mark.boundingBox();
    const headingBox = await heading.boundingBox();
    const cardBox = await cards[0]!.boundingBox();
    expect(
      Math.abs(
        (markBox!.y + markBox!.height / 2) -
          (headingBox!.y + headingBox!.height / 2),
      ),
    ).toBeLessThanOrEqual(8);
    expect(markBox!.x).toBeGreaterThanOrEqual(
      headingBox!.x + headingBox!.width,
    );
    expect(markBox!.x + markBox!.width).toBeLessThanOrEqual(
      cardBox!.x + cardBox!.width,
    );

    // The score counts the graded answer.
    await expect(summaryCard.getByText("1 of 2")).toBeVisible();

    // Clicking "Mistake" on the second card marks that card ✗ without
    // changing the number of correct answers.
    const mistakeButton = cards[1]!.getByRole("button", {
      name: "Mistake",
      exact: true,
    });
    const card2Mark = cards[1]!.getByText("✗");
    await expect
      .poll(
        async () => {
          await mistakeButton.click();
          return card2Mark.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect(summaryCard.getByText("1 of 2")).toBeVisible();
    await expect(summaryCard.getByText("0 of 2")).toHaveCount(0);
  });

  test("a submission that is not yet submitted shows no grading buttons", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: false });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    // The author can still open an in-progress submission and see what the
    // student answered so far...
    for (let i = 0; i < QUESTIONS.length; i++) {
      await expect(
        page.getByRole("heading", {
          name: `Question #${i + 1}`,
          exact: true,
        }),
      ).toBeVisible();
    }

    // ...but nothing is gradeable yet: no Correct or Mistake buttons render
    // anywhere on the page until the submission reaches 'submitted' status.
    await expect(
      page.getByRole("button", { name: "Correct", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Mistake", exact: true }),
    ).toHaveCount(0);
  });

  test("a non-author cannot access the submission review page", async ({
    page,
  }) => {
    // The course is authored by OTHER_USER; TEST_USER is only its student
    // (assignee). Authorship alone must open the review page.
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, TEST_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    // The route's loader guard throws for users who do not own the course,
    // so only the error card renders and no review content leaks.
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Question #1", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(STUDENT_ANSWERS[0]!, { exact: true }),
    ).toHaveCount(0);
  });

  test("an assignment id that does not match the submission shows an error page", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    // The URL carries a different (but well-formed) assignment id than the
    // one the submission belongs to: the loader must not render the review.
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId + 1, submissionId));

    // The mismatch throws, so the error card renders and no review content
    // leaks — the URL cannot be spoofed with a foreign assignment id.
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toBeVisible();
    await expect(page.getByText("404 - not found")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Question #1", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(STUDENT_ANSWERS[0]!, { exact: true }),
    ).toHaveCount(0);
  });

  test("a missing submission id shows a 404 page", async ({ page }) => {
    const { courseId, assignmentId } = await setupSubmissionForReview(page, {
      submitted: true,
    });

    // The id is a well-formed positive integer that no submission row has,
    // so the server fn returns null and the loader throws notFound().
    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, 999_999_999));

    // A missing submission is a 404, not the generic error card.
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Question #1", exact: true }),
    ).toHaveCount(0);
  });

  test("an unanswered question in a submitted submission shows no grading buttons", async ({
    page,
  }) => {
    // Only the first question gets an answer row; the second stays
    // unanswered (student answer null) even though the submission is
    // submitted.
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, {
        submitted: true,
        answeredCount: 1,
      });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    // The answered question still offers both grading actions...
    const answeredCard = page
      .locator(".card")
      .filter({ hasText: QUESTIONS[0]! });
    await expect(
      answeredCard.getByRole("button", { name: "Correct", exact: true }),
    ).toHaveCount(1);
    await expect(
      answeredCard.getByRole("button", { name: "Mistake", exact: true }),
    ).toHaveCount(1);

    // ...but the unanswered question renders no grading actions. Grading
    // it is impossible (no submission_answers row exists to update), and
    // showing buttons there used to break the whole page with an error.
    const unansweredCard = page
      .locator(".card")
      .filter({ hasText: QUESTIONS[1]! });
    await expect(unansweredCard.getByText(QUESTIONS[1]!)).toBeVisible();
    await expect(
      unansweredCard.getByRole("button", { name: "Correct", exact: true }),
    ).toHaveCount(0);
    await expect(
      unansweredCard.getByRole("button", { name: "Mistake", exact: true }),
    ).toHaveCount(0);
    // The page stays healthy: no error card replaces the review.
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toHaveCount(0);
  });
});

/**
 * Issue #12: the author can close a reviewed submission.
 *
 * The contract (from the issue, plus the state decisions documented per
 * test): the summary card of a submitted submission offers a
 * [Mark as completed] button. Clicking it lands back on the same review
 * page, where the [Correct] and [Mistake] buttons no longer render. The
 * completed state survives a reload, so tests assert on the rendered UI
 * only — how it persists (a column on assignment_submissions or
 * otherwise) stays an implementation choice.
 */
test.describe("mark a submission as completed", () => {
  test("the summary card offers the course author a Mark as completed button", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    await expect(
      summaryCard.getByRole("button", {
        name: "Mark as completed",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("an in-progress submission offers no Mark as completed button", async ({
    page,
  }) => {
    // Completing makes sense only after the student submitted: an
    // in-progress submission can still change, so the action must not be
    // offered for it (matching how grading buttons are already withheld).
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: false });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    await expect(
      page.getByRole("button", { name: "Mark as completed", exact: true }),
    ).toHaveCount(0);
  });

  test("clicking Mark as completed lands back on the review page without grading buttons", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    // Hydration in dev can lag the SSR-rendered button (a click that falls
    // through does nothing — the grading test documents the same race), so
    // retry the click until the grading buttons disappear. The click can
    // also throw once the button unmounts mid-navigation; both count as
    // progress, not failure.
    const completeButton = page.getByRole("button", {
      name: "Mark as completed",
      exact: true,
    });
    await expect
      .poll(
        async () => {
          try {
            await completeButton.click({ timeout: 2_000 });
          } catch {
            // The button is gone: completion already happened.
          }
          return page.getByRole("button", { name: "Correct", exact: true })
            .count();
        },
        { timeout: 15_000 },
      )
      .toBe(0);

    // The action returns to the same page, not somewhere else.
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}$`),
    );
    await expect(
      page.getByRole("button", { name: "Mistake", exact: true }),
    ).toHaveCount(0);

    // The review itself stays readable: the summary card still renders.
    await expect(
      page.locator(".card").filter({ hasText: TEST_USER.email }),
    ).toBeVisible();
  });

  test("grading buttons stay hidden after completing and reloading the page", async ({
    page,
  }) => {
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    const completeButton = page.getByRole("button", {
      name: "Mark as completed",
      exact: true,
    });
    await expect
      .poll(
        async () => {
          try {
            await completeButton.click({ timeout: 2_000 });
          } catch {
            // The button is gone: completion already happened.
          }
          return page.getByRole("button", { name: "Correct", exact: true })
            .count();
        },
        { timeout: 15_000 },
      )
      .toBe(0);

    // The completed state persists server-side: a fresh load of the same
    // URL still hides both grading actions, and the page stays healthy.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Correct", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Mistake", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Question #1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toHaveCount(0);

    // The closed review also shows its completion date on the summary
    // card, next to the started date.
    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    await expect(summaryCard.getByText(/^Completed: /)).toBeVisible();
  });

  test("a completed submission still shows the graded marks and score", async ({
    page,
  }) => {
    // Completing closes the review for editing; it must not erase the
    // grading results the author already recorded.
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, OTHER_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    const cards = QUESTIONS.map((question) =>
      page.locator(".card").filter({ hasText: question }),
    );

    // Grade the first answer Correct first (same hydration retry as the
    // grading test above).
    const correctButton = cards[0]!.getByRole("button", {
      name: "Correct",
      exact: true,
    });
    const card1Mark = cards[0]!.getByText("✓");
    await expect
      .poll(
        async () => {
          await correctButton.click();
          return card1Mark.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    const completeButton = page.getByRole("button", {
      name: "Mark as completed",
      exact: true,
    });
    await expect
      .poll(
        async () => {
          try {
            await completeButton.click({ timeout: 2_000 });
          } catch {
            // The button is gone: completion already happened.
          }
          return page.getByRole("button", { name: "Correct", exact: true })
            .count();
        },
        { timeout: 15_000 },
      )
      .toBe(0);

    // The recorded mark and the score survive the completion.
    await expect(cards[0]!.getByText("✓")).toBeVisible();
    const summaryCard = page
      .locator(".card")
      .filter({ hasText: TEST_USER.email });
    await expect(summaryCard.getByText("1 of 2")).toBeVisible();
    await expect(summaryCard.getByText("0 of 2")).toHaveCount(0);
  });

  test("only the course author reaches the page, so the action stays author-only", async ({
    page,
  }) => {
    // The course is authored by OTHER_USER; TEST_USER is only its student.
    // The loader already blocks non-authors from the whole review page
    // (see the non-author test above), so the student must neither see
    // the review nor the Mark as completed action.
    const { courseId, assignmentId, submissionId } =
      await setupSubmissionForReview(page, { submitted: true });

    await loginViaUi(page, TEST_USER);
    await page.goto(reviewPath(courseId, assignmentId, submissionId));

    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark as completed", exact: true }),
    ).toHaveCount(0);
  });
});
