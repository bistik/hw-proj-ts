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

// Issue #43: the [Move down] button on /courses/<id>, Course Details tab,
// becomes functional for the course author. Clicking it swaps the item's
// position with the item below it in course_items (the example from the
// issue: [item A - position 2] [item B - position 3], after [item A] is
// moved down: [item A - position 3] [item B - position 2]). While the move
// is in progress, every other move button disables and the clicked button
// shows a loading animation. The feature stays author-only.
test.describe("author moves a course item down (issue #43)", () => {
  // How long each client→server server-fn call stays pending. TanStack
  // Start posts server fn calls to /_serverFn/<functionId>; the delay
  // widens the in-flight window so tests can observe the pending state
  // (disabled buttons, loading animation) deterministically.
  const SERVER_FN_DELAY_MS = 500;

  // Delays every server fn call the page makes. The tests that use it
  // trigger exactly one server fn call each (the move), so the delay
  // cannot slow anything else down.
  async function slowServerFnCalls(page: Page): Promise<void> {
    await page.route("**/_serverFn/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SERVER_FN_DELAY_MS));
      await route.continue();
    });
  }

  test("the author's Move down button is not disabled", async ({ page }) => {
    const title = `Move down course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Move down buttons must be clickable.",
    });
    const [assignment1Id, assignment2Id] = await seedAssignments(courseId, [
      "Move down first assignment",
      "Move down last assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: assignment1Id, position: 2 },
      { itemType: "assignment", itemId: assignment2Id, position: 3 },
    ]);

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");

    // The first card has an item below it, so it shows [Move down]. The
    // button must be clickable now that issue #43 wires it, not a
    // disabled no-op placeholder. The last card has no item below it, so
    // it renders no [Move down] at all (issue #33 pins that in
    // author-course-items.spec.ts).
    const firstCard = page
      .locator(".card")
      .filter({ hasText: "Move down first assignment" });
    const lastCard = page
      .locator(".card")
      .filter({ hasText: "Move down last assignment" });
    await expect(
      firstCard.getByRole("button", { name: "Move down" }),
    ).toBeEnabled();
    await expect(
      lastCard.getByRole("button", { name: "Move down" }),
    ).toHaveCount(0);
  });

  test("the move down feature is available to the course author only", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const title = `Author only move course ${Date.now()}`;
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
    await expect(page.getByRole("button", { name: "Move down" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Move up" })).toHaveCount(0);

    // The author outline page itself stays closed to non-authors, so the
    // student cannot reach the [Move down] button by URL either.
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();

    // The outline row keeps its seeded position.
    expect(await getCourseItemRow("lesson", lessonId)).toEqual({
      course_id: courseId,
      position: 2,
    });
  });

  test("clicking Move down disables every other move button while the move is in progress", async ({
    page,
  }) => {
    const title = `Pending move course ${Date.now()}`;
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

    await firstCard.getByRole("button", { name: "Move down" }).click();

    // While the move is in flight, no other move button may start a
    // second reorder: the middle card's [Move up]/[Move down] and the
    // last card's [Move up] all disable.
    await expect(
      middleCard.getByRole("button", { name: "Move up" }),
    ).toBeDisabled();
    await expect(
      middleCard.getByRole("button", { name: "Move down" }),
    ).toBeDisabled();
    await expect(
      lastCard.getByRole("button", { name: "Move up" }),
    ).toBeDisabled();

    // Once the move completes, the wired buttons come back: the moved
    // item ("Pending first assignment") now sits in the middle, so its
    // card shows both move buttons and its [Move down] is clickable
    // again. [Move up] stays a disabled no-op placeholder until issue #44
    // wires it (author-course-items.spec.ts pins that).
    await expect(
      firstCard.getByRole("button", { name: "Move down" }),
    ).toBeEnabled();
    await expect(
      lastCard.getByRole("button", { name: "Move up" }),
    ).toBeDisabled();
  });

  test("the clicked Move down button shows a loading animation while the move is in progress", async ({
    page,
  }) => {
    const title = `Loading move course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course whose Move down button shows a pending spinner.",
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

    const firstCard = page
      .locator(".card")
      .filter({ hasText: "Loading first assignment" });
    const moveDownButton = firstCard.getByRole("button", {
      name: "Move down",
    });
    await moveDownButton.click();

    // While the move runs, the clicked button shows the daisyUI loading
    // spinner, like the ConfirmModal's Okay button while its server fn
    // runs.
    await expect(moveDownButton.locator(".loading")).toBeVisible();

    // The animation ends when the move completes.
    await expect(moveDownButton.locator(".loading")).toHaveCount(0);
  });

  test("clicking Move down swaps the item's position with the item below it", async ({
    page,
  }) => {
    // The example from the issue: [item A - position 2] [item B -
    // position 3], after [item A] is moved down: [item A - position 3]
    // [item B - position 2]. The third item sits at a gapped position 5,
    // so a whole-outline renumber could not fake the swap.
    const title = `Swap down course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course to move the first item one position down.",
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

    await cardA.getByRole("button", { name: "Move down" }).click();

    // The outline re-renders with A below B.
    await expect(async () => {
      const boxA = await cardA.boundingBox();
      const boxB = await cardB.boundingBox();
      expect(boxA!.y, "A must sit below B after the move").toBeGreaterThan(
        boxB!.y,
      );
    }).toPass();

    // The database holds the swapped positions: A takes B's position, B
    // takes A's position, and C keeps its gapped position.
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
