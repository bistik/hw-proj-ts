import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedLesson,
} from "./helpers/db";
import { TEST_USER } from "./test-user";

// Issue #33: on /courses/<id>, Course Details tab, the author sees each
// course item by position (course_items.position), in a card UI like
// SubmissionCard / AnswerCard, with move up / move down buttons that stay
// disabled until issue #34 wires them to the reorder endpoint.
test.describe("author course details items", () => {
  test("items are displayed in course_items.position order", async ({
    page,
  }) => {
    // The course is authored by TEST_USER: the /courses/<id> loaders only
    // serve the course to its author.
    const title = `Author ordered course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose outline order differs from id order.",
    });

    // Lessons are created first, so their ids are lower than the
    // assignments' ids. The outline interleaves the types, so neither the
    // "all lessons, then all assignments" split nor id order can produce
    // the expected display order — only course_items.position.
    const lesson1Id = await seedLesson(courseId, {
      title: "Author lesson one",
      content: "Content for e2e lesson Author lesson one",
    });
    const lesson2Id = await seedLesson(courseId, {
      title: "Author lesson two",
      content: "Content for e2e lesson Author lesson two",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Author assignment one",
      "Author assignment two",
    ]);
    await seedCourseItems(courseId, [
      // Inserted out of position order, with non-consecutive positions:
      // sorts to assignment1 (10), assignment2 (20), lesson1 (30), lesson2 (40).
      { itemType: "lesson", itemId: lesson1Id, position: 30 },
      { itemType: "assignment", itemId: assignment1Id, position: 10 },
      { itemType: "lesson", itemId: lesson2Id, position: 40 },
      { itemType: "assignment", itemId: assignment2Id, position: 20 },
    ]);

    await loginViaUi(page);
    // No ?tab= param: Course Details is the default tab.
    await page.goto(`/courses/${courseId}`);

    // One card per item, identified by its title text.
    const expectedOrder = [
      "Author assignment one",
      "Author assignment two",
      "Author lesson one",
      "Author lesson two",
    ];
    const boxes: Array<{ title: string; y: number }> = [];
    for (const itemTitle of expectedOrder) {
      const card = page.locator(".card").filter({ hasText: itemTitle });
      await expect(card).toHaveCount(1);
      const box = await card.boundingBox();
      boxes.push({ title: itemTitle, y: box!.y });
    }

    // Display order: each card sits below the card for the item with the
    // next lower position (vertical stack, like the student course page).
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
    const title = `Author card course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose items render as cards for the author.",
    });
    const lessonId = await seedLesson(courseId, {
      title: "Author card lesson",
      content: "Content for e2e lesson Author card lesson",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Author card assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
      { itemType: "assignment", itemId: assignmentId, position: 1 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);

    // Each item renders as a daisyUI card whose .card-title holds the
    // item's title, like SubmissionCard and AnswerCard.
    for (const itemTitle of ["Author card lesson", "Author card assignment"]) {
      const card = page.locator(".card").filter({ hasText: itemTitle });
      await expect(card).toHaveCount(1);
      await expect(card.locator(".card-title")).toBeVisible();
      await expect(card.locator(".card-title")).toContainText(itemTitle);
    }
  });

  test("move up and move down buttons follow the item's position", async ({
    page,
  }) => {
    const title = `Author buttons course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course with three items to check the move buttons.",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Author first assignment",
      "Author last assignment",
    ]);
    const lessonId = await seedLesson(courseId, {
      title: "Author middle lesson",
      content: "Content for e2e lesson Author middle lesson",
    });
    await seedCourseItems(courseId, [
      // Display order: first assignment, middle lesson, last assignment.
      { itemType: "assignment", itemId: assignment1Id, position: 0 },
      { itemType: "lesson", itemId: lessonId, position: 1 },
      { itemType: "assignment", itemId: assignment2Id, position: 2 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);

    // The first item shows only [move down]: it has no item above it.
    // The last item shows only [move up]: it has no item below it.
    // Each middle item shows both buttons.
    const firstCard = page
      .locator(".card")
      .filter({ hasText: "Author first assignment" });
    const middleCard = page
      .locator(".card")
      .filter({ hasText: "Author middle lesson" });
    const lastCard = page
      .locator(".card")
      .filter({ hasText: "Author last assignment" });

    await expect(firstCard.getByRole("button", { name: "Move up" })).toHaveCount(
      0,
    );
    await expect(
      firstCard.getByRole("button", { name: "Move down" }),
    ).toBeVisible();

    await expect(
      middleCard.getByRole("button", { name: "Move up" }),
    ).toBeVisible();
    await expect(
      middleCard.getByRole("button", { name: "Move down" }),
    ).toBeVisible();

    await expect(lastCard.getByRole("button", { name: "Move up" })).toBeVisible();
    await expect(
      lastCard.getByRole("button", { name: "Move down" }),
    ).toHaveCount(0);
  });

  test("a course with a single item shows neither move button", async ({
    page,
  }) => {
    const title = `Author single course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course with one item: first and last position at once.",
    });
    const lessonId = await seedLesson(courseId, {
      title: "Author only lesson",
      content: "Content for e2e lesson Author only lesson",
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);

    // The only item is at both first and last position, so both move
    // buttons stay hidden.
    const card = page.locator(".card").filter({ hasText: "Author only lesson" });
    await expect(card).toHaveCount(1);
    await expect(card.getByRole("button", { name: "Move up" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Move down" })).toHaveCount(
      0,
    );
    // Issue #40 adds the delete action to lesson cards, so the card body
    // now renders to hold the one button the single lesson shows.
    await expect(
      card.getByRole("button", { name: "Delete lesson" }),
    ).toBeVisible();
  });

  test("move up stays disabled until issue #44 wires it", async ({ page }) => {
    const title = `Author no-op course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose move up button must stay a no-op.",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Author no-op first",
      "Author no-op last",
    ]);
    const lessonId = await seedLesson(courseId, {
      title: "Author no-op middle",
      content: "Content for e2e lesson Author no-op middle",
    });
    await seedCourseItems(courseId, [
      // Display order: first (0), middle (1), last (2).
      { itemType: "assignment", itemId: assignment1Id, position: 0 },
      { itemType: "lesson", itemId: lessonId, position: 1 },
      { itemType: "assignment", itemId: assignment2Id, position: 2 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);

    // Issue #43 wires the [Move down] button (see
    // author-move-item-down.spec.ts), so it renders enabled. [Move up]
    // still has no server wiring: it stays disabled until issue #44
    // wires it.
    const middleCard = page
      .locator(".card")
      .filter({ hasText: "Author no-op middle" });
    await expect(
      middleCard.getByRole("button", { name: "Move up" }),
    ).toBeDisabled();
    await expect(
      middleCard.getByRole("button", { name: "Move down" }),
    ).toBeEnabled();
  });
});
