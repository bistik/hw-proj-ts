import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import { seedCourse, seedEnrollment } from "./helpers/db";
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
});
