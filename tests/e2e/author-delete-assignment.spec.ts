import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  getAnswerRow,
  getAssignmentRow,
  getCourseItemRow,
  getQuestionRow,
  getSubmissionRow,
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
  seedLesson,
  seedQuestions,
  seedSubmission,
  seedSubmissionAnswer,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #41: the course author can delete an assignment. The delete
// action lives on the assignment's outline card (Course Details tab),
// next to the lesson delete (issue #40). The action opens the
// ConfirmModal before it runs. The delete removes the assignment row
// and its course_items row in one transaction. The author cannot
// delete while a student of the course has not submitted: the student's
// submission row has no submitted_at value, or the student has no
// submission row. The delete does not renumber the other outline rows.
// Questions, submissions, and submission answers go with the
// assignment (database cascade).
//
// TDD: no implementation exists yet, so every test below must fail.
test.describe("author deletes an assignment (issue #41)", () => {
  // Issue #41 test 3: the author deletes the assignment through the
  // outline card. The database loses the assignment row and its
  // course_items row. The outline no longer shows the assignment.
  test("the author deletes an assignment from its outline card", async ({
    page,
  }) => {
    const title = `Delete assignment course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course with an assignment to delete and an item to keep.",
    });
    const lessonTitle = `Remaining lesson ${Date.now()}`;
    const assignmentTitle = `Deletable assignment ${Date.now()}`;
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

    const lessonCard = page.locator(".card").filter({ hasText: lessonTitle });
    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: assignmentTitle });

    // The assignment card carries its own delete action. The lesson
    // card keeps the lesson one (issue #40).
    await expect(
      assignmentCard.getByRole("button", { name: "Delete assignment" }),
    ).toBeVisible();
    await expect(
      lessonCard.getByRole("button", { name: "Delete lesson" }),
    ).toBeVisible();

    await assignmentCard
      .getByRole("button", { name: "Delete assignment" })
      .click();

    // The ConfirmModal opens and names the assignment, so the author
    // knows what the delete removes. "Okay" and "Cancel" come from
    // ConfirmModal.
    const modalBox = page.locator(".modal-box");
    await expect(modalBox).toBeVisible();
    await expect(modalBox).toContainText(assignmentTitle);
    await modalBox.getByRole("button", { name: "Okay" }).click();

    // The outline drops the assignment but keeps the lesson.
    await expect(assignmentCard).toHaveCount(0);
    await expect(lessonCard).toBeVisible();

    // The assignment row and its course_items row are both gone. The
    // course_items delete must run with the assignment delete (the
    // table has no foreign key on item_id, so the database cannot
    // cascade).
    expect(await getAssignmentRow(assignmentId)).toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).toBeNull();

    // The item that was not deleted keeps its outline row.
    expect(await getCourseItemRow("lesson", lessonId)).toEqual({
      course_id: courseId,
      position: 0,
    });
  });

  // The ConfirmModal must not delete anything when the author cancels.
  test("cancel in the confirm dialog keeps the assignment", async ({
    page,
  }) => {
    const title = `Cancel delete course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose assignment must survive a cancelled delete.",
    });
    const assignmentTitle = `Kept assignment ${Date.now()}`;
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const card = page.locator(".card").filter({ hasText: assignmentTitle });
    await card.getByRole("button", { name: "Delete assignment" }).click();

    const modalBox = page.locator(".modal-box");
    await expect(modalBox).toBeVisible();
    await modalBox.getByRole("button", { name: "Cancel" }).click();

    // The modal closes, the outline still shows the assignment, and
    // both rows still exist in the database.
    await expect(modalBox).not.toBeVisible();
    await expect(card).toBeVisible();
    expect(await getAssignmentRow(assignmentId)).not.toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).not.toBeNull();
  });

  // Issue #41 test 2: a student has an in-progress submission (no
  // submitted_at value). The application blocks the delete and shows a
  // clear error. Both rows stay in the database.
  test("the delete is blocked while a student has not submitted", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Unsubmitted course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose assignment a student has not submitted.",
    });
    const assignmentTitle = `Guarded assignment ${Date.now()}`;
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);
    await seedEnrollment(OTHER_USER.email, courseId);
    // In-progress submission: no submitted_at value.
    await seedSubmission(assignmentId, OTHER_USER.email, null);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: assignmentTitle });
    await assignmentCard
      .getByRole("button", { name: "Delete assignment" })
      .click();
    await page
      .locator(".modal-box")
      .getByRole("button", { name: "Okay" })
      .click();

    // The application blocks the delete and tells the author why.
    await expect(page.getByText(/unsubmitted/i)).toBeVisible();

    // The outline still shows the assignment, and both rows stay in
    // the database.
    await expect(assignmentCard).toBeVisible();
    expect(await getAssignmentRow(assignmentId)).not.toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).not.toBeNull();
  });

  // Issue #41 test 2, second half of the guard definition: an enrolled
  // student with no submission row at all also counts as "has not
  // submitted".
  test("the delete is blocked while an enrolled student has no submission row", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `No submission course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose assignment no student has started.",
    });
    const assignmentTitle = `Unstarted assignment ${Date.now()}`;
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);
    // OTHER_USER is enrolled but has no submission row.
    await seedEnrollment(OTHER_USER.email, courseId);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: assignmentTitle });
    await assignmentCard
      .getByRole("button", { name: "Delete assignment" })
      .click();
    await page
      .locator(".modal-box")
      .getByRole("button", { name: "Okay" })
      .click();

    await expect(page.getByText(/unsubmitted/i)).toBeVisible();
    await expect(assignmentCard).toBeVisible();
    expect(await getAssignmentRow(assignmentId)).not.toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).not.toBeNull();
  });

  // Issue #41 test 2: every student of the course has submitted. The
  // delete goes through, and the dependent rows cascade.
  test("an assignment with all submissions in can be deleted", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `All submitted course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose assignment every student has submitted.",
    });
    const assignmentTitle = `Submitted assignment ${Date.now()}`;
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);
    const [questionId] = await seedQuestions(assignmentId, [
      "Cascade check question",
    ]);
    const submissionId = await seedSubmission(
      assignmentId,
      OTHER_USER.email,
      Date.now(),
    );
    await seedSubmissionAnswer(
      assignmentId,
      OTHER_USER.email,
      questionId,
      "Student answer",
    );
    await seedEnrollment(OTHER_USER.email, courseId);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: assignmentTitle });
    await assignmentCard
      .getByRole("button", { name: "Delete assignment" })
      .click();
    await page
      .locator(".modal-box")
      .getByRole("button", { name: "Okay" })
      .click();

    await expect(assignmentCard).toHaveCount(0);

    // The assignment row and its course_items row are gone.
    expect(await getAssignmentRow(assignmentId)).toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).toBeNull();

    // The questions, submissions, and submission answers go with the
    // assignment (database cascade).
    expect(await getQuestionRow(questionId)).toBeNull();
    expect(await getSubmissionRow(submissionId)).toBeNull();
    expect(await getAnswerRow(questionId, submissionId)).toBeNull();
  });

  // Issue #41 test 1, restriction part: an enrolled student sees the
  // assignment in the student view, but no delete action. The author
  // outline page stays closed to the student. The rows stay in the
  // database.
  test("an enrolled student cannot delete the assignment", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Student delete course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose assignment a student must not delete.",
    });
    const assignmentTitle = `Student-view assignment ${Date.now()}`;
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/courses/${courseId}`);

    // The student view shows the assignment card, but it has no delete
    // action.
    const card = page.locator(".card").filter({ hasText: assignmentTitle });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Delete assignment" }),
    ).toHaveCount(0);

    // The author outline page does not open for the student: the
    // loader serves the course to its author only.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();

    expect(await getAssignmentRow(assignmentId)).not.toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).not.toBeNull();
  });

  // Issue #41 test 1, restriction part: a user who is not the author
  // and not enrolled gets no page that shows a delete action. The rows
  // stay in the database.
  test("a non-author user cannot delete the assignment", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Other user delete course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose assignment another user must not delete.",
    });
    const assignmentTitle = `Guarded assignment ${Date.now()}`;
    const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentId, position: 0 },
    ]);

    // TEST_USER owns nothing here: not the author, not enrolled.
    await loginViaUi(page, TEST_USER);

    // Both the author outline page and the student view reject the
    // user.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await page.goto(`/student/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();

    expect(await getAssignmentRow(assignmentId)).not.toBeNull();
    expect(await getCourseItemRow("assignment", assignmentId)).not.toBeNull();
  });

  // Issue #41 test 4: the delete must not renumber the other outline
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
    const middleTitle = `Middle assignment ${Date.now()}`;
    const lastTitle = `Last lesson ${Date.now()}`;
    const firstLessonId = await seedLesson(courseId, {
      title: firstTitle,
      content: `Content for e2e lesson ${firstTitle}`,
    });
    const [assignmentId] = await seedAssignments(courseId, [middleTitle]);
    const lastLessonId = await seedLesson(courseId, {
      title: lastTitle,
      content: `Content for e2e lesson ${lastTitle}`,
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: firstLessonId, position: 0 },
      { itemType: "assignment", itemId: assignmentId, position: 1 },
      { itemType: "lesson", itemId: lastLessonId, position: 2 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const firstCard = page.locator(".card").filter({ hasText: firstTitle });
    const middleCard = page.locator(".card").filter({ hasText: middleTitle });
    const lastCard = page.locator(".card").filter({ hasText: lastTitle });
    await expect(middleCard).toBeVisible();

    await middleCard
      .getByRole("button", { name: "Delete assignment" })
      .click();
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
    expect(await getCourseItemRow("lesson", lastLessonId)).toEqual({
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
