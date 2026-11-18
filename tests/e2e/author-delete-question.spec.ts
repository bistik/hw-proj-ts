import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  getQuestionRow,
  seedAssignments,
  seedCourse,
  seedEnrollment,
  seedQuestions,
} from "./helpers/db";
import { slowServerFnCalls } from "./helpers/server-fn";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #54: the course author can delete a question from the
// /assignments/<id> page. Each question row carries a [Delete question]
// button. The action opens the ConfirmModal (src/components/confirm-modal.tsx)
// before it runs — the same flow as the delete-lesson action (issue #40);
// this was confirmed as the intended design for issue #54. While the delete
// runs, the Okay button disables and shows a loading spinner. After the
// delete, the page reloads its data and no longer lists the deleted
// question. The delete stays author-only: the page loader already serves
// /assignments/<id> to the course author alone, so a non-author never
// reaches the rows.
test.describe("author deletes a question (issue #54)", () => {
  // Issue #54, button part: every question row shows the [Delete question]
  // button in the author view.
  test("each question row shows a Delete question button", async ({ page }) => {
    const title = `Delete question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose question rows need a delete action.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Delete question assignment",
    ]);
    const firstText = `First seeded question ${Date.now()}`;
    const secondText = `Second seeded question ${Date.now()}`;
    await seedQuestions(assignmentId, [firstText, secondText]);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    // Wait for hydration so React handles the click (loginViaUi pattern).
    await page.waitForLoadState("networkidle");

    // Each question row carries its own delete action.
    const firstRow = page.locator("ul li").filter({ hasText: firstText });
    const secondRow = page.locator("ul li").filter({ hasText: secondText });
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();
    await expect(
      firstRow.getByRole("button", { name: "Delete question" }),
    ).toBeVisible();
    await expect(
      secondRow.getByRole("button", { name: "Delete question" }),
    ).toBeVisible();
  });

  // Issue #54 tests 1 and 2: the author deletes one of two questions.
  // The ConfirmModal names the question. While the deleteQuestion server
  // fn is in flight, the Okay button is disabled and shows the daisyUI
  // loading spinner. After the delete, the deleted question is no longer
  // listed, the other question stays, and the questions row is gone from
  // the database.
  test("the author deletes a question from its row", async ({ page }) => {
    const title = `Delete one question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course with two questions, one of which gets deleted.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Delete one question assignment",
    ]);
    const deletableText = `Deletable question ${Date.now()}`;
    const remainingText = `Remaining question ${Date.now()}`;
    const [deletableId] = await seedQuestions(assignmentId, [
      deletableText,
      remainingText,
    ]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    const deletableRow = page.locator("ul li").filter({ hasText: deletableText });
    const remainingRow = page.locator("ul li").filter({ hasText: remainingText });

    await deletableRow.getByRole("button", { name: "Delete question" }).click();

    // The ConfirmModal opens and names the question, so the author knows
    // what the delete removes. "Okay" and "Cancel" come from
    // ConfirmModal.
    const modalBox = page.locator(".modal-box");
    await expect(modalBox).toBeVisible();
    await expect(modalBox).toContainText(deletableText);

    await modalBox.getByRole("button", { name: "Okay" }).click();

    // While the deleteQuestion server fn is in flight, the Okay button
    // must not accept a second confirmation and must show the delete
    // progress animation (like the ConfirmModal use in issue #40).
    const okayButton = modalBox.getByRole("button", { name: "Okay" });
    await expect(okayButton).toBeDisabled();
    await expect(okayButton.locator(".loading")).toBeVisible();

    // The delete ends and the page refreshes its data: the modal closes,
    // the deleted question is no longer listed, and the other question
    // keeps its row.
    await expect(modalBox).not.toBeVisible();
    await expect(deletableRow).toHaveCount(0);
    await expect(remainingRow).toBeVisible();

    // The questions row itself is gone; the other row survives.
    expect(await getQuestionRow(deletableId)).toBeNull();
  });

  // The ConfirmModal must not delete anything when the author cancels.
  test("cancel in the confirm dialog keeps the question", async ({ page }) => {
    const title = `Cancel delete question course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose question must survive a cancelled delete.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Cancel delete question assignment",
    ]);
    const keptText = `Kept question ${Date.now()}`;
    const [keptId] = await seedQuestions(assignmentId, [keptText]);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    const row = page.locator("ul li").filter({ hasText: keptText });
    await row.getByRole("button", { name: "Delete question" }).click();

    const modalBox = page.locator(".modal-box");
    await expect(modalBox).toBeVisible();
    await modalBox.getByRole("button", { name: "Cancel" }).click();

    // The modal closes, the page still lists the question, and the row
    // still exists in the database.
    await expect(modalBox).not.toBeVisible();
    await expect(row).toBeVisible();
    expect(await getQuestionRow(keptId)).not.toBeNull();
  });

  // Issue #54, restriction part: a user who is not the course author
  // gets no author view and no delete action. The question rows stay in
  // the database.
  test("a non-author user cannot delete a question", async ({ page }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Non-author delete question course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose question another user must not delete.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Non-author delete question assignment",
    ]);
    const guardedText = `Guarded question ${Date.now()}`;
    const [guardedId] = await seedQuestions(assignmentId, [guardedText]);
    // TEST_USER is enrolled but not the author: the delete must stay
    // closed to them all the same.
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);

    // The assignment detail page stays closed to non-authors: TEST_USER
    // gets the router's not-found page instead of the question rows.
    await page.goto(`/assignments/${assignmentId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(page.getByText(guardedText)).toHaveCount(0);

    // The student assignment page shows the questions as Q# step links,
    // but the [Delete question] button is an author tool and must not
    // render there. The seeded question sits at position 0, so it shows
    // as "Q1".
    await page.goto(`/student/assignments/${assignmentId}`);
    await expect(page.getByText("Q1")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete question" }),
    ).toHaveCount(0);

    expect(await getQuestionRow(guardedId)).not.toBeNull();
  });
});
