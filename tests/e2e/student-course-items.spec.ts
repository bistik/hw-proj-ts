import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
  seedLesson,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #32: on /student/courses/<id> each course item must be displayed
// by position (course_items.position) and rendered in a card UI, following
// the SubmissionCard / AnswerCard components' daisyUI card markup.
test.describe("student course page items", () => {
  test("items are displayed in course_items.position order", async ({
    page,
  }) => {
    // A course authored by OTHER_USER, reached only through the enrollment
    // row, like in real student usage.
    await ensureSignedUp(OTHER_USER);
    const title = `Ordered course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course with an outline whose order differs from id order.",
    });

    // Lessons are created first, so their ids are lower than the
    // assignments' ids; the rows' created_at order is lesson, lesson,
    // assignment, assignment. The outline interleaves the types, so neither
    // the "all lessons, then all assignments" split nor id/created_at order
    // can produce the expected display order — only course_items.position.
    const lesson1Id = await seedLesson(courseId, {
      title: "Lesson one",
      content: "Content for e2e lesson Lesson one",
    });
    const lesson2Id = await seedLesson(courseId, {
      title: "Lesson two",
      content: "Content for e2e lesson Lesson two",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Assignment one",
      "Assignment two",
    ]);
    await seedCourseItems(courseId, [
      // Inserted out of position order, with non-consecutive positions:
      // sorts to assignment1 (10), assignment2 (20), lesson1 (30), lesson2 (40).
      { itemType: "lesson", itemId: lesson1Id, position: 30 },
      { itemType: "assignment", itemId: assignment1Id, position: 10 },
      { itemType: "lesson", itemId: lesson2Id, position: 40 },
      { itemType: "assignment", itemId: assignment2Id, position: 20 },
    ]);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // One card per item, identified by its title text.
    const expectedOrder = [
      "Assignment one",
      "Assignment two",
      "Lesson one",
      "Lesson two",
    ];
    const boxes: Array<{ title: string; y: number }> = [];
    for (const itemTitle of expectedOrder) {
      const card = page.locator(".card").filter({ hasText: itemTitle });
      await expect(card).toHaveCount(1);
      const box = await card.boundingBox();
      boxes.push({ title: itemTitle, y: box!.y });
    }

    // Display order: each card sits below the card for the item with the
    // next lower position (vertical stack, like the answer cards on the
    // author submission review page).
    for (let i = 1; i < boxes.length; i += 1) {
      expect(
        boxes[i]!.y,
        `${boxes[i]!.title} must sit below ${boxes[i - 1]!.title}`,
      ).toBeGreaterThan(boxes[i - 1]!.y);
    }
  });

  test("each item is displayed in a card UI like SubmissionCard and AnswerCard", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Card course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose items render as cards.",
    });
    const lessonId = await seedLesson(courseId, {
      title: "Card lesson",
      content: "Content for e2e lesson Card lesson",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Card assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
      { itemType: "assignment", itemId: assignmentId, position: 1 },
    ]);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // Lesson card: the item title is the card's heading, linking to the
    // lesson page for students (/student/lessons/<id>).
    const lessonCard = page.locator(".card").filter({ hasText: "Card lesson" });
    await expect(lessonCard).toHaveCount(1);
    await expect(lessonCard.locator(".card-title")).toBeVisible();
    const lessonLink = lessonCard.getByRole("link", { name: "Card lesson" });
    await expect(lessonLink).toBeVisible();
    await expect(lessonLink).toHaveAttribute(
      "href",
      `/student/lessons/${lessonId}`,
    );

    // Assignment card: same card UI, linking to the student assignment page.
    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: "Card assignment" });
    await expect(assignmentCard).toHaveCount(1);
    await expect(assignmentCard.locator(".card-title")).toBeVisible();
    const assignmentLink = assignmentCard.getByRole("link", {
      name: "Card assignment",
    });
    await expect(assignmentLink).toBeVisible();
    await expect(assignmentLink).toHaveAttribute(
      "href",
      `/student/assignments/${assignmentId}`,
    );

    // The per-assignment status badge stays inside its card.
    await expect(assignmentCard.locator(".badge")).toBeVisible();
  });
});
