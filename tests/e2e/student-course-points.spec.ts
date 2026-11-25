import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #89: /student/courses/<id> shows the student's accumulated
// points below the course title, as "Points: X / Y". X (earned) sums
// assignments.points over the student's answers with is_correct = true.
// Y (possible) sums assignment.points x question count over all
// assignments in the course.
//
// Test-driven development red phase: the page shows no points line yet,
// so the spec fails until the feature exists.

test.describe("student course points (issue #89)", () => {
  test("shows 'Points: X / Y' below the course title after grading", async ({
    page,
  }) => {
    // A course authored by OTHER_USER, reached only through the
    // enrollment row, like in real student usage.
    await ensureSignedUp(OTHER_USER);
    const title = `Points course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose student page shows the accumulated points.",
    });

    // One assignment worth 4 points with two questions. The student
    // submitted, and the author graded one answer correct and left the
    // other ungraded: earned = 4 x 1 correct answer, possible = 4 x 2
    // questions.
    const [assignmentId] = await seedAssignments(
      courseId,
      ["Points assignment"],
      4,
    );
    const [correctQuestionId, ungradedQuestionId] = await seedQuestions(
      assignmentId,
      ["Correct question", "Ungraded question"],
    );
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);
    await seedEnrollment(TEST_USER.email, courseId);
    await seedSubmission(assignmentId, TEST_USER.email, Date.now());
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      correctQuestionId,
      "Student answer",
      true,
    );
    await seedSubmissionAnswer(
      assignmentId,
      TEST_USER.email,
      ungradedQuestionId,
      "Student answer",
      null,
    );

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // The contract issue #89 fixes for the display: the points render
    // as "Points: 4 / 8" below the course title heading.
    const titleHeading = page.getByRole("heading", { name: title, exact: true });
    await expect(titleHeading).toBeVisible();

    const pointsText = page.getByText("Points: 4 / 8");
    await expect(pointsText).toBeVisible();

    // "Below the course title": the points text starts at a greater y
    // coordinate than the title heading.
    const titleBox = await titleHeading.boundingBox();
    const pointsBox = await pointsText.boundingBox();
    expect(titleBox, "the course title heading is rendered").toBeTruthy();
    expect(pointsBox, "the points text is rendered").toBeTruthy();
    expect(pointsBox!.y).toBeGreaterThan(titleBox!.y);
  });
});
