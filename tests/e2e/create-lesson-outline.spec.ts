import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  getCourseItemRow,
  getLessonIdByTitle,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
  seedLesson,
} from "./helpers/db";
import { createLessonViaUi } from "./helpers/lesson";
import { TEST_USER } from "./test-user";

// Issue #35: dbCreateLesson (src/db/lessons/mutate-lesson.ts) inserts only
// the lessons row. Per the schema contract (src/db/schema.ts, course_items
// comment) it must also insert the course_items outline row with the next
// free position (max + 1). The student page /student/courses/<id> builds its
// item list from course_items only (dbGetEnrollmentByCourseAndStudent in
// src/db/courses/get-course.ts), so a lesson without an outline row is
// invisible to students even though the author sees it on the lessons tab.
test.describe("create lesson adds the outline row", () => {
  test("posting the create lesson form inserts the course_items row with the next position", async ({
    page,
  }) => {
    await ensureSignedUp(TEST_USER);
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Outline course ${Date.now()}`,
      description: "Course whose new lessons must get a course_items row.",
    });

    // One pre-existing outline row at position 0: the new lesson's row must
    // take the next position (max + 1 = 1) instead of colliding with an
    // existing position on the course_items_course_position_unique index.
    const existingLessonId = await seedLesson(courseId, {
      title: "Existing outlined lesson",
      content: "Content for e2e lesson Existing outlined lesson",
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: existingLessonId, position: 0 },
    ]);

    await loginViaUi(page, TEST_USER);
    const newLessonTitle = `Form lesson ${Date.now()}`;
    await createLessonViaUi(page, courseId, {
      title: newLessonTitle,
      content: "Content typed into the create lesson form.",
    });

    // The form navigated to the lessons tab, so the lessons row exists.
    // Now the outline row must exist too, for this course, at position 1.
    const lessonId = await getLessonIdByTitle(courseId, newLessonTitle);
    const outlineRow = await getCourseItemRow("lesson", lessonId);
    expect(outlineRow, "course_items row for the new lesson").toBeTruthy();
    expect(outlineRow!.course_id).toBe(courseId);
    expect(outlineRow!.position).toBe(1);
  });

  test("the lesson created through the form shows on /student/courses/<id>", async ({
    page,
  }) => {
    await ensureSignedUp(TEST_USER);
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Student view course ${Date.now()}`,
      description: "Course whose student page must list the new lesson.",
    });
    const existingLessonId = await seedLesson(courseId, {
      title: "Outlined lesson",
      content: "Content for e2e lesson Outlined lesson",
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: existingLessonId, position: 0 },
    ]);
    // The author is enrolled, so the student page reads this course's
    // outline through the enrollment row like in real student usage.
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    const newLessonTitle = `Student visible lesson ${Date.now()}`;
    await createLessonViaUi(page, courseId, {
      title: newLessonTitle,
      content: "Content typed into the create lesson form.",
    });

    const lessonId = await getLessonIdByTitle(courseId, newLessonTitle);
    await page.goto(`/student/courses/${courseId}`);

    // Guard: the page renders the seeded outline item, so the missing new
    // lesson below is the bug, not a broken page.
    await expect(
      page.locator(".card").filter({ hasText: "Outlined lesson" }),
    ).toHaveCount(1);

    // One card per outline item; the new lesson must be among them and
    // link to the student lesson page (like the seeded outline items).
    const lessonCard = page.locator(".card").filter({ hasText: newLessonTitle });
    await expect(lessonCard).toHaveCount(1);
    const lessonLink = lessonCard.getByRole("link", { name: newLessonTitle });
    await expect(lessonLink).toBeVisible();
    await expect(lessonLink).toHaveAttribute(
      "href",
      `/student/lessons/${lessonId}`,
    );
  });
});
