import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  getCourseItemRow,
  getLessonRow,
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
  seedLesson,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #40: the course author can delete a lesson. The delete action
// lives on the lesson's outline card (Course Details tab). The action
// opens the ConfirmModal (src/components/confirm-modal.tsx) before it
// runs. The delete removes the lesson row and its course_items row in
// one transaction. The delete does not renumber the other outline rows.
// Assignment cards get no delete action: issue #41 covers them.
test.describe("author deletes a lesson (issue #40)", () => {
  // Issue #40 tests 1 and 2: the author deletes the lesson through the
  // outline card. The database loses the lesson row and its
  // course_items row. The outline no longer shows the lesson.
  test("the author deletes a lesson from its outline card", async ({
    page,
  }) => {
    const title = `Delete lesson course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course with a lesson to delete and an item to keep.",
    });
    const lessonTitle = `Deletable lesson ${Date.now()}`;
    const assignmentTitle = `Remaining assignment ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Content for e2e lesson ${lessonTitle}`,
    });
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
      { itemType: "assignment", itemId: assignmentId, position: 1 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    // Wait for hydration so React handles the click (loginViaUi pattern).
    await page.waitForLoadState("networkidle");

    const lessonCard = page
      .locator(".card")
      .filter({ hasText: lessonTitle });
    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: assignmentTitle });

    // Only lesson cards carry the delete action. Assignment cards do
    // not get it: issue #41 handles assignments.
    await expect(
      lessonCard.getByRole("button", { name: "Delete lesson" }),
    ).toBeVisible();
    await expect(
      assignmentCard.getByRole("button", { name: "Delete lesson" }),
    ).toHaveCount(0);

    await lessonCard.getByRole("button", { name: "Delete lesson" }).click();

    // The ConfirmModal opens and names the lesson, so the author knows
    // what the delete removes. "Okay" and "Cancel" come from
    // ConfirmModal.
    const modalBox = page.locator(".modal-box");
    await expect(modalBox).toBeVisible();
    await expect(modalBox).toContainText(lessonTitle);
    await modalBox.getByRole("button", { name: "Okay" }).click();

    // The outline drops the lesson but keeps the other items.
    await expect(lessonCard).toHaveCount(0);
    await expect(assignmentCard).toBeVisible();

    // The lesson row and its course_items row are both gone. The
    // course_items delete must run with the lesson delete (the table
    // has no foreign key on item_id, so the database cannot cascade).
    expect(await getLessonRow(lessonId)).toBeNull();
    expect(await getCourseItemRow("lesson", lessonId)).toBeNull();

    // The item that was not deleted keeps its outline row.
    expect(await getCourseItemRow("assignment", assignmentId)).toEqual({
      course_id: courseId,
      position: 1,
    });
  });

  // The ConfirmModal must not delete anything when the author cancels.
  test("cancel in the confirm dialog keeps the lesson", async ({ page }) => {
    const title = `Cancel delete course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose lesson must survive a cancelled delete.",
    });
    const lessonTitle = `Kept lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Content for e2e lesson ${lessonTitle}`,
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const card = page.locator(".card").filter({ hasText: lessonTitle });
    await card.getByRole("button", { name: "Delete lesson" }).click();

    const modalBox = page.locator(".modal-box");
    await expect(modalBox).toBeVisible();
    await modalBox.getByRole("button", { name: "Cancel" }).click();

    // The modal closes, the outline still shows the lesson, and both
    // rows still exist in the database.
    await expect(modalBox).not.toBeVisible();
    await expect(card).toBeVisible();
    expect(await getLessonRow(lessonId)).not.toBeNull();
    expect(await getCourseItemRow("lesson", lessonId)).not.toBeNull();
  });

  // Issue #40 test 1, restriction part: an enrolled student sees the
  // lesson in the student view, but no delete action. The author
  // outline page stays closed to the student. The rows stay in the
  // database.
  test("an enrolled student cannot delete the lesson", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Student delete course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose lesson a student must not delete.",
    });
    const lessonTitle = `Student-view lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Content for e2e lesson ${lessonTitle}`,
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
    ]);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // The student view shows the lesson card, but it has no delete
    // action.
    const card = page.locator(".card").filter({ hasText: lessonTitle });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Delete lesson" }),
    ).toHaveCount(0);

    // The author outline page does not open for the student: the loader
    // serves the course to its author only.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();

    expect(await getLessonRow(lessonId)).not.toBeNull();
    expect(await getCourseItemRow("lesson", lessonId)).not.toBeNull();
  });

  // Issue #40 test 1, restriction part: a user who is not the author
  // and not enrolled gets no page that shows a delete action. The rows
  // stay in the database.
  test("a non-author user cannot delete the lesson", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Other user delete course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose lesson another user must not delete.",
    });
    const lessonTitle = `Guarded lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Content for e2e lesson ${lessonTitle}`,
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 0 },
    ]);

    // TEST_USER owns nothing here: not the author, not enrolled.
    await loginViaUi(page, TEST_USER);

    // Both the author outline page and the student view reject the
    // user.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await page.goto(`/student/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();

    expect(await getLessonRow(lessonId)).not.toBeNull();
    expect(await getCourseItemRow("lesson", lessonId)).not.toBeNull();
  });

  // Issue #40 test 3: the delete must not renumber the other outline
  // rows. Delete the middle item of three. The other two keep their
  // positions, and the outline keeps their relative order.
  test("the delete keeps the positions of the remaining items", async ({
    page,
  }) => {
    const title = `Positions course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course with three items to check position stability.",
    });
    const firstTitle = `First lesson ${Date.now()}`;
    const middleTitle = `Middle lesson ${Date.now()}`;
    const lastTitle = `Last assignment ${Date.now()}`;
    const firstLessonId = await seedLesson(courseId, {
      title: firstTitle,
      content: `Content for e2e lesson ${firstTitle}`,
    });
    const middleLessonId = await seedLesson(courseId, {
      title: middleTitle,
      content: `Content for e2e lesson ${middleTitle}`,
    });
    const [assignmentId] = await seedAssignments(courseId, [lastTitle]);
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: firstLessonId, position: 0 },
      { itemType: "lesson", itemId: middleLessonId, position: 1 },
      { itemType: "assignment", itemId: assignmentId, position: 2 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const firstCard = page.locator(".card").filter({ hasText: firstTitle });
    const middleCard = page.locator(".card").filter({ hasText: middleTitle });
    const lastCard = page.locator(".card").filter({ hasText: lastTitle });
    await expect(middleCard).toBeVisible();

    await middleCard.getByRole("button", { name: "Delete lesson" }).click();
    await page
      .locator(".modal-box")
      .getByRole("button", { name: "Okay" })
      .click();
    await expect(middleCard).toHaveCount(0);

    // The remaining rows keep their seeded positions. A renumbering
    // would change the last row to position 1: it must stay 2.
    expect(await getCourseItemRow("lesson", firstLessonId)).toEqual({
      course_id: courseId,
      position: 0,
    });
    expect(await getCourseItemRow("assignment", assignmentId)).toEqual({
      course_id: courseId,
      position: 2,
    });

    // The outline still shows both remaining items, first above last.
    await expect(firstCard).toBeVisible();
    await expect(lastCard).toBeVisible();
    const firstBox = await firstCard.boundingBox();
    const lastBox = await lastCard.boundingBox();
    expect(firstBox!.y).toBeLessThan(lastBox!.y);
  });
});
