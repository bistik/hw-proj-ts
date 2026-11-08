import { expect, type Page, test } from "@playwright/test";
import {
  ensureSignedUp,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import {
  seedAssignments,
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
 */
async function createAssignmentWithQuestionsOwnedByOtherUser(
  page: Page,
  questionTexts: string[],
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
  const questionIds = await seedQuestions(assignmentId, questionTexts);
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
