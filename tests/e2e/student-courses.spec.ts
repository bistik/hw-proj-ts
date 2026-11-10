import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  seedAssignments,
  seedCourse,
  seedEnrollment,
  seedSubmission,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

test.describe("student course page", () => {
  test("a declined student gets the not-found page instead of the course", async ({
    page,
  }) => {
    // A course authored by OTHER_USER, so TEST_USER can only reach it
    // through an enrollment row (there is no author path for students).
    await ensureSignedUp(OTHER_USER);
    const title = `Declined course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course the E2E user declined.",
    });
    await seedEnrollment(TEST_USER.email, courseId, "declined");

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // A declined enrollment must not grant access: the route loader throws
    // notFound and the router's defaultNotFoundComponent renders.
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  });

  test("assignments show a status badge for each submission state", async ({
    page,
  }) => {
    // A course authored by OTHER_USER, reached only through the enrollment
    // row, like in real student usage.
    await ensureSignedUp(OTHER_USER);
    const title = `Badge course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course with assignments in different submission states.",
    });
    const [submittedAssignmentId, inProgressAssignmentId] =
      await seedAssignments(courseId, [
        "Submitted assignment",
        "In progress assignment",
        "Open assignment",
      ]);
    // One submission with submitted_at set (done), one started but not
    // submitted (submitted_at null), and no submission for the third, so
    // each row earns a different badge.
    await seedSubmission(submittedAssignmentId, TEST_USER.email, Date.now());
    await seedSubmission(inProgressAssignmentId, TEST_USER.email);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // Like the enrollment roster badges on /courses/<id>?tab=enrollments:
    // a daisyUI badge (span.badge) in the assignment's row, carrying the
    // status text. Scoping the badge to the listitem that holds the
    // assignment title proves the badge sits on that row.
    const submittedRow = page
      .getByRole("listitem")
      .filter({ hasText: "Submitted assignment" });
    await expect(submittedRow).toBeVisible();
    await expect(submittedRow.locator(".badge")).toHaveText("submitted");

    // A start with submitted_at still null counts as in progress.
    const inProgressRow = page
      .getByRole("listitem")
      .filter({ hasText: "In progress assignment" });
    await expect(inProgressRow).toBeVisible();
    await expect(inProgressRow.locator(".badge")).toHaveText("in progress");

    // The untouched assignment must show the not submitted badge.
    const openRow = page
      .getByRole("listitem")
      .filter({ hasText: "Open assignment" });
    await expect(openRow).toBeVisible();
    await expect(openRow.locator(".badge")).toHaveText("not submitted");
  });
});
