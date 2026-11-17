import { expect, test, type Page } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  getCourseItemRow,
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
  seedLesson,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #44: the [Move up] button on /courses/<id>, Course Details tab,
// becomes functional for the course author. Clicking it swaps the item's
// position with the item above it in course_items (the example from the
// issue: [item A - position 2] [item B - position 3], after [item B] is
// moved up: [item A - position 3] [item B - position 2]). While the move
// is in progress, every other move button disables and the clicked button
// shows a loading animation. The feature stays author-only.
test.describe("author moves a course item up (issue #44)", () => {
  // How long each client→server server-fn call stays pending. TanStack
  // Start posts server fn calls to /_serverFn/<functionId>; the delay
  // widens the in-flight window so tests can observe the pending state
  // (disabled buttons, loading animation) deterministically.
  const SERVER_FN_DELAY_MS = 500;

  // Delays every server fn call the page makes. The tests that use it
  // trigger exactly one server fn call each (the move), so the delay
  // cannot slow anything else down. This holds because login posts to
  // /api/auth, not /_serverFn; if login ever becomes a server fn,
  // install this route after loginViaUi so it does not delay the login.
  async function slowServerFnCalls(page: Page): Promise<void> {
    await page.route("**/_serverFn/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SERVER_FN_DELAY_MS));
      await route.continue();
    });
  }

  test("the author's Move up button is not disabled", async ({ page }) => {
    const title = `Move up course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Move up buttons must be clickable.",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Move up first assignment",
      "Move up last assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignment1Id, position: 2 },
      { itemType: "assignment", itemId: assignment2Id, position: 3 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    // The last card has an item above it, so it shows [Move up]. The
    // button must be clickable now that issue #44 wires it, not a
    // disabled no-op placeholder. The first card has no item above it, so
    // it renders no [Move up] at all (issue #33 pins that in
    // author-course-items.spec.ts).
    const firstCard = page
      .locator(".card")
      .filter({ hasText: "Move up first assignment" });
    const lastCard = page
      .locator(".card")
      .filter({ hasText: "Move up last assignment" });
    await expect(
      lastCard.getByRole("button", { name: "Move up" }),
    ).toBeEnabled();
    await expect(
      firstCard.getByRole("button", { name: "Move up" }),
    ).toHaveCount(0);
  });

  test("the move up feature is available to the course author only", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Author only move up course ${Date.now()}`;
    const courseId = await seedCourse(OTHER_USER.email, {
      title,
      description: "Course whose items a student must not be able to move.",
    });
    const lessonTitle = `Student view lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content: `Content for e2e lesson ${lessonTitle}`,
    });
    await seedCourseItems(courseId, [
      { itemType: "lesson", itemId: lessonId, position: 2 },
    ]);
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);

    // The enrolled student sees the item on the student course page, but
    // move controls are author tools: no move button renders there.
    await page.goto(`/student/courses/${courseId}`);
    const card = page.locator(".card").filter({ hasText: lessonTitle });
    await expect(card).toBeVisible();
    await expect(page.getByRole("button", { name: "Move up" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Move down" })).toHaveCount(
      0,
    );

    // The author outline page itself stays closed to non-authors, so the
    // student cannot reach the [Move up] button by URL either.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();

    // The outline row keeps its seeded position.
    expect(await getCourseItemRow("lesson", lessonId)).toEqual({
      course_id: courseId,
      position: 2,
    });
  });

  test("clicking Move up disables every other move button while the move is in progress", async ({
    page,
  }) => {
    const title = `Pending move up course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose other move buttons disable during a move.",
    });
    const [assignment1Id, assignment3Id] = await seedAssignments(courseId, [
      "Pending first assignment",
      "Pending last assignment",
    ]);
    const lessonId = await seedLesson(courseId, {
      title: "Pending middle lesson",
      content: "Content for e2e lesson Pending middle lesson",
    });
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignment1Id, position: 2 },
      { itemType: "lesson", itemId: lessonId, position: 3 },
      { itemType: "assignment", itemId: assignment3Id, position: 4 },
    ]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const firstCard = page
      .locator(".card")
      .filter({ hasText: "Pending first assignment" });
    const middleCard = page
      .locator(".card")
      .filter({ hasText: "Pending middle lesson" });
    const lastCard = page
      .locator(".card")
      .filter({ hasText: "Pending last assignment" });

    await middleCard.getByRole("button", { name: "Move up" }).click();

    // While the move is in flight, no other move button may start a
    // second reorder: the first card's [Move down], the middle card's
    // [Move down], and the last card's [Move up] all disable.
    await expect(
      firstCard.getByRole("button", { name: "Move down" }),
    ).toBeDisabled();
    await expect(
      middleCard.getByRole("button", { name: "Move down" }),
    ).toBeDisabled();
    await expect(
      lastCard.getByRole("button", { name: "Move up" }),
    ).toBeDisabled();

    // Once the move completes, the wired buttons come back: the middle
    // item ("Pending middle lesson") now sits first, so the first item's
    // card shows a clickable [Move down], and the last item keeps its
    // [Move up].
    await expect(
      firstCard.getByRole("button", { name: "Move down" }),
    ).toBeEnabled();
    await expect(
      lastCard.getByRole("button", { name: "Move up" }),
    ).toBeEnabled();
  });

  test("the clicked Move up button shows a loading animation while the move is in progress", async ({
    page,
  }) => {
    const title = `Loading move up course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Move up button shows a pending spinner.",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Loading first assignment",
      "Loading last assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignment1Id, position: 2 },
      { itemType: "assignment", itemId: assignment2Id, position: 3 },
    ]);

    await slowServerFnCalls(page);
    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const lastCard = page
      .locator(".card")
      .filter({ hasText: "Loading last assignment" });
    const moveUpButton = lastCard.getByRole("button", { name: "Move up" });
    await moveUpButton.click();

    // While the move runs, the clicked button shows the daisyUI loading
    // spinner, like the clicked [Move down] button (issue #43) and the
    // ConfirmModal's Okay button while its server fn runs.
    await expect(moveUpButton.locator(".loading")).toBeVisible();

    // The animation ends when the move completes.
    await expect(moveUpButton.locator(".loading")).toHaveCount(0);
  });

  test("clicking Move up swaps the item's position with the item above it", async ({
    page,
  }) => {
    // The example from the issue: [item A - position 2] [item B -
    // position 3], after [item B] is moved up: [item A - position 3]
    // [item B - position 2]. The third item sits at a gapped position 5,
    // so a whole-outline renumber could not fake the swap.
    const title = `Swap up course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course to move the last item one position up.",
    });
    const [assignmentAId, assignmentBId, assignmentCId] =
      await seedAssignments(courseId, [
        "Swapped item A",
        "Swapped item B",
        "Swapped item C",
      ]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignmentAId, position: 2 },
      { itemType: "assignment", itemId: assignmentBId, position: 3 },
      { itemType: "assignment", itemId: assignmentCId, position: 5 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    const cardA = page.locator(".card").filter({ hasText: "Swapped item A" });
    const cardB = page.locator(".card").filter({ hasText: "Swapped item B" });

    await cardB.getByRole("button", { name: "Move up" }).click();

    // The outline re-renders with B above A.
    await expect(async () => {
      const boxA = await cardA.boundingBox();
      const boxB = await cardB.boundingBox();
      expect(boxB!.y, "B must sit above A after the move").toBeLessThan(
        boxA!.y,
      );
    }).toPass();

    // The database holds the swapped positions: B takes A's position, A
    // takes B's position, and C keeps its gapped position.
    expect(await getCourseItemRow("assignment", assignmentAId)).toEqual({
      course_id: courseId,
      position: 3,
    });
    expect(await getCourseItemRow("assignment", assignmentBId)).toEqual({
      course_id: courseId,
      position: 2,
    });
    expect(await getCourseItemRow("assignment", assignmentCId)).toEqual({
      course_id: courseId,
      position: 5,
    });
  });
});
