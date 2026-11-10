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
  seedEnrollment,
  seedQuestions,
  seedSubmission,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

/**
 * Creates a course authored by OTHER_USER with one seeded assignment, and
 * returns the course and assignment ids. The course is deliberately NOT
 * TEST_USER's: the only route to its student assignment page must be the
 * enrollment row.
 */
async function createAssignmentOwnedByOtherUser(page: Page) {
  await ensureSignedUp(OTHER_USER);
  await loginViaUi(page, OTHER_USER);
  const title = `Student assignment course ${Date.now()}`;
  const coursePath = await createCourseViaUi(page, {
    title,
    description: "Authored by the second E2E user.",
  });
  const courseId = Number(/\/courses\/(\d+)$/.exec(coursePath)![1]);
  // Seed directly in the e2e DB (faster and more robust than walking the
  // author's /assignments/new form); the id is needed because the student
  // assignment page lives at /student/assignments/<assignment_id>.
  const [assignmentId] = await seedAssignments(courseId, [
    "Enrollment-gated assignment",
  ]);
  await logoutViaUi(page);
  return { courseId, assignmentId };
}

test.describe("student assignment page", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    // The id itself doesn't matter: the _authenticated layout's beforeLoad
    // redirect fires before the student assignment route's loader runs.
    await expectRedirectedToLogin(page, "/student/assignments/1");
  });

  test("an enrolled student sees the assignment flow", async ({ page }) => {
    const { courseId, assignmentId } =
      await createAssignmentOwnedByOtherUser(page);

    // TEST_USER is enrolled directly in the e2e DB (faster than walking the
    // author's Enrollment form, which is also how the student routes find
    // their access). Reach the assignment through the student course page's
    // assignment links instead of the raw URL, so the test follows the same
    // path a student would take in the app.
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    await page
      .getByRole("link", { name: "Enrollment-gated assignment" })
      .click();

    // The loader passed requireUserEnrolledInCourse, and the seeded
    // assignment has no questions, so the flow page renders its "no
    // questions" notice instead of any question steps.
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );
    await expect(
      page.getByText("No questions on this assignment"),
    ).toBeVisible();
  });

  test("a non-enrolled student is blocked from the assignment flow", async ({
    page,
  }) => {
    // A fresh course (and assignment) the current user is not enrolled in.
    const { assignmentId } = await createAssignmentOwnedByOtherUser(page);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/assignments/${assignmentId}`);

    // The route's loader (src/routes/_authenticated/student/assignments/
    // $assignmentId/index.tsx) calls getStudentQuestions, whose
    // requireUserEnrolledInCourse check throws for non-enrolled users, so
    // the flow content is never rendered — only the error card stays.
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toBeVisible();
    await expect(page.getByText("No questions on this assignment")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Go to question #1" }),
    ).toHaveCount(0);
  });

  test("the course author cannot access the student assignment page", async ({
    page,
  }) => {
    // The helper's course is authored by OTHER_USER and gets no enrollment
    // row for them: authorship alone must not open the student view, only
    // the enrollment row does.
    const { assignmentId } = await createAssignmentOwnedByOtherUser(page);

    await loginViaUi(page, OTHER_USER);
    // Authors have no student path to this page inside the course UI, so
    // the direct URL visit is the path that must be guarded.
    await page.goto(`/student/assignments/${assignmentId}`);

    // Same guard result as for any other non-enrolled visitor: the loader's
    // requireUserEnrolledInCourse check throws, so only the error card
    // renders.
    await expect(
      page.getByRole("heading", { name: "Oops! Something went wrong" }),
    ).toBeVisible();
    await expect(page.getByText("No questions on this assignment")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Go to question #1" }),
    ).toHaveCount(0);
  });

  test("an enrolled student sees a 'Back to course' link to the student course page", async ({
    page,
  }) => {
    const { courseId, assignmentId } =
      await createAssignmentOwnedByOtherUser(page);

    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    // Enrollment passes the loader's guard, so the direct URL visit renders
    // the flow page (its "no questions" branch with this seed).
    await page.goto(`/student/assignments/${assignmentId}`);

    // The flow page needs exactly one 'Back to course' link that targets
    // /student/courses/<course_id>.
    const backLink = page.getByRole("link", { name: "Back to course" });
    await expect(backLink).toHaveCount(1);
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute(
      "href",
      `/student/courses/${courseId}`,
    );

    // Following the link must land on this course's student course page.
    await backLink.click();
    await expect(page).toHaveURL(new RegExp(`/student/courses/${courseId}$`));
  });

  test("an enrolled student sees a 'Submit assignment' button beside 'Go to question #1'", async ({
    page,
  }) => {
    const { courseId, assignmentId } =
      await createAssignmentOwnedByOtherUser(page);

    // Questions in the seeded assignment make the flow page render its
    // step list and the "Go to question #1" CTA the new button must sit
    // beside.
    await seedQuestions(assignmentId, ["First question", "Second question"]);
    // The page only renders the button for an in-progress submission
    // (submission record present, submitted_at null), so seed one like a
    // student who already opened question #1.
    await seedSubmission(assignmentId, TEST_USER.email);
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like loginViaUi/createCourseViaUi: wait for hydration so the
    // assignment link click is handled by React (client-side) instead of a
    // full page load, leaving the fresh assignment page pre-hydrated.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Enrollment-gated assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    // The baseline CTA the new button is anchored to.
    const goToQuestion = page.getByRole("link", {
      name: "Go to question #1",
    });
    await expect(goToQuestion).toBeVisible();

    // A real "Submit assignment" button rendered beside "Go to question #1"
    // (src/routes/_authenticated/student/assignments/$assignmentId/
    // index.tsx), i.e. on the same visual row, to its right.
    const submitButton = page.getByRole("button", {
      name: "Submit assignment",
    });
    await expect(submitButton).toBeVisible();
    const ctaBox = await goToQuestion.boundingBox();
    const submitBox = await submitButton.boundingBox();
    // Same row: centers share a y band (8px handles exact-text vertical
    // centering differences without allowing stacked layouts).
    expect(Math.abs(submitBox!.y - ctaBox!.y)).toBeLessThanOrEqual(8);
    // Beside, not above or below: every part of the button starts right
    // of the CTA's right edge.
    expect(submitBox!.x).toBeGreaterThanOrEqual(ctaBox!.x + ctaBox!.width);
  });

  test("clicking 'Submit assignment' opens a daisyUI modal with Okay and Cancel", async ({
    page,
  }) => {
    const { courseId, assignmentId } =
      await createAssignmentOwnedByOtherUser(page);

    // Same setup as the "Submit assignment button" test: questions make the
    // flow page render the CTA the modal is triggered from, and the
    // in-progress submission is what makes the button render at all.
    await seedQuestions(assignmentId, ["First question", "Second question"]);
    await seedSubmission(assignmentId, TEST_USER.email);
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like loginViaUi/createCourseViaUi: wait for hydration so the
    // assignment link click is handled by React (client-side) instead of a
    // full page load, leaving the fresh assignment page pre-hydrated.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Enrollment-gated assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    const submitButton = page.getByRole("button", {
      name: "Submit assignment",
    });
    await expect(submitButton).toBeVisible();

    // Clicking "Submit assignment" must open a daisyUI modal (daisyUI marks
    // the container with the .modal class) with exactly two actions: Okay
    // and Cancel.
    const modal = page.locator(".modal");
    // Hydration in dev can lag the SSR-rendered button; a click that falls
    // through does nothing (loginViaUi documents the same race), so retry
    // until the modal is open.
    await expect
      .poll(
        async () => {
          await submitButton.click();
          return modal.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const okayButton = modal.getByRole("button", { name: "Okay" });
    const cancelButton = modal.getByRole("button", { name: "Cancel" });
    await expect(okayButton).toBeVisible();
    await expect(cancelButton).toBeVisible();
    // Exactly one of each action, and nothing else masquerading as one.
    await expect(okayButton).toHaveCount(1);
    await expect(cancelButton).toHaveCount(1);

    // Confirming must mark the submission as submitted and reload the
    // route, so the button no longer renders (submitted_at is now set).
    await okayButton.click();
    await expect(submitButton).not.toBeVisible();
    // …and the flow stays intact after the reload.
    await expect(
      page.getByText(/0 of 2 questions have been answered/),
    ).toBeVisible();
  });

  test("a student whose submission is already submitted sees no 'Submit assignment' button", async ({
    page,
  }) => {
    const { courseId, assignmentId } =
      await createAssignmentOwnedByOtherUser(page);

    await seedQuestions(assignmentId, ["First question", "Second question"]);
    // A submission with submitted_at set, like after the Okay confirmation.
    await seedSubmission(assignmentId, TEST_USER.email, Date.now());
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like the other tests: hydrate before the assignment link click.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Enrollment-gated assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    await expect(
      page.getByRole("button", { name: "Submit assignment" }),
    ).toHaveCount(0);
    await expect(page.locator(".modal")).toHaveCount(0);
  });

  test("a student without a submission record sees no 'Submit assignment' button", async ({
    page,
  }) => {
    const { courseId, assignmentId } =
      await createAssignmentOwnedByOtherUser(page);

    await seedQuestions(assignmentId, ["First question", "Second question"]);
    await seedEnrollment(TEST_USER.email, courseId);
    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);
    // Like the other tests: hydrate before the assignment link click.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Enrollment-gated assignment" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/student/assignments/${assignmentId}$`),
    );

    await expect(
      page.getByRole("button", { name: "Submit assignment" }),
    ).toHaveCount(0);
    await expect(page.locator(".modal")).toHaveCount(0);
  });
});
