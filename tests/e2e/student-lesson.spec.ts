import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import { seedCourse, seedEnrollment, seedLesson } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #38: /student/lessons/<id> is still a stub page. It must show the
// lesson to the enrolled student. Acceptance items:
// 1. The page shows the lesson content.
// 2. The page shows the lesson title.
// 3. The page shows breadcrumbs: [Course title link] > [Current lesson
//    title].
//
// The course crumb links back to the student course page
// (/student/courses/<id>), not the author page (/courses/<id>): the visitor
// here is a student, who has no author access.
test.describe("student lesson page", () => {
  test("shows the lesson title and content", async ({ page }) => {
    // A course authored by OTHER_USER, reached only through the enrollment
    // row, like in real student usage.
    await ensureSignedUp(OTHER_USER);
    const courseId = await seedCourse(OTHER_USER.email, {
      title: `Lesson view course ${Date.now()}`,
      description: "Course whose lesson the student opens.",
    });
    const lessonTitle = `Student lesson ${Date.now()}`;
    const lessonContent = `Content of ${lessonTitle}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: lessonContent,
    });
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    // The title is the page heading, like the card title on the student
    // course page.
    await expect(
      page.getByRole("heading", { name: lessonTitle }),
    ).toBeVisible();

    // The content renders as the lesson's body text, not the stub page's
    // "Hello" placeholder.
    await expect(page.getByText(lessonContent)).toBeVisible();
    await expect(
      page.getByText(`Hello "/_authenticated/student/lessons/$lessonId"`),
    ).toHaveCount(0);
  });

  test("shows breadcrumbs: course title link > lesson title text", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const courseTitle = `Crumb course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title: courseTitle,
      description: "Course whose title must appear in the breadcrumb trail.",
    });
    const lessonTitle = `Crumb lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Content of ${lessonTitle}`,
    });
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    // The breadcrumb trail (daisyUI .breadcrumbs, see
    // src/components/common/breadcrumbs.tsx) has two crumbs:
    // - the course title as a link back to the student course page;
    // - the lesson title as plain text (not a link), like the lesson crumb
    //   on the course-scoped lesson edit page.
    const breadcrumbs = page.locator(".breadcrumbs");

    const courseCrumb = breadcrumbs.getByRole("link", { name: courseTitle });
    await expect(courseCrumb).toBeVisible();
    await expect(courseCrumb).toHaveAttribute(
      "href",
      `/student/courses/${courseId}`,
    );

    // exact: true, because the lesson title may contain the course title
    // as a substring and getByText without exact matches substrings.
    const lessonCrumb = breadcrumbs.getByText(lessonTitle, { exact: true });
    await expect(lessonCrumb).toBeVisible();
    // The lesson title is the current page: text only, never a link.
    await expect(lessonCrumb).not.toHaveRole("link");
    await expect(
      breadcrumbs.getByRole("link", { name: lessonTitle, exact: true }),
    ).toHaveCount(0);
  });
});
