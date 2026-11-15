import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import { createAssignmentViaUi } from "./helpers/assignment";
import {
  getAssignmentIdByTitle,
  getCourseItemRow,
  seedAssignments,
  seedCourse,
  seedCourseItems,
  seedEnrollment,
} from "./helpers/db";
import { TEST_USER } from "./test-user";

// Issue #36: dbCreateAssignment (src/db/assignments/mutate-assignment.ts)
// inserts only the assignments row. Per the schema contract
// (src/db/schema.ts, course_items comment) it must also insert the
// course_items outline row with the next free position (max + 1). The
// student page /student/courses/<id> builds its item list from
// course_items only (dbGetEnrollmentByCourseAndStudent in
// src/db/courses/get-course.ts), so an assignment without an outline row
// is invisible to students even though the author sees it on the
// assignments tab.
test.describe("create assignment adds the outline row", () => {
  test("posting the create assignment form inserts the course_items row with the next position", async ({
    page,
  }) => {
    await ensureSignedUp(TEST_USER);
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Outline course ${Date.now()}`,
      description: "Course whose new assignments must get a course_items row.",
    });

    // One pre-existing outline row at position 0: the new assignment's row
    // must take the next position (max + 1 = 1) instead of colliding with
    // an existing position on the course_items_course_position_unique
    // index.
    const [existingAssignmentId] = await seedAssignments(courseId, [
      "Existing outlined assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: existingAssignmentId, position: 0 },
    ]);

    await loginViaUi(page, TEST_USER);
    const newAssignmentTitle = `Form assignment ${Date.now()}`;
    await createAssignmentViaUi(page, courseId, {
      title: newAssignmentTitle,
      example: "Example typed into the create assignment form.",
    });

    // The form navigated to the assignments tab, so the assignments row
    // exists. Now the outline row must exist too, for this course, at
    // position 1.
    const assignmentId = await getAssignmentIdByTitle(
      courseId,
      newAssignmentTitle,
    );
    const outlineRow = await getCourseItemRow("assignment", assignmentId);
    expect(outlineRow, "course_items row for the new assignment").toBeTruthy();
    expect(outlineRow!.course_id).toBe(courseId);
    expect(outlineRow!.position).toBe(1);
  });

  test("the assignment created through the form shows on /student/courses/<id>", async ({
    page,
  }) => {
    await ensureSignedUp(TEST_USER);
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Student view course ${Date.now()}`,
      description: "Course whose student page must list the new assignment.",
    });
    const [existingAssignmentId] = await seedAssignments(courseId, [
      "Outlined assignment",
    ]);
    await seedCourseItems(courseId, [
      { itemType: "assignment", itemId: existingAssignmentId, position: 0 },
    ]);
    // The author is enrolled, so the student page reads this course's
    // outline through the enrollment row like in real student usage.
    await seedEnrollment(TEST_USER.email, courseId);

    await loginViaUi(page, TEST_USER);
    const newAssignmentTitle = `Student visible assignment ${Date.now()}`;
    await createAssignmentViaUi(page, courseId, {
      title: newAssignmentTitle,
      example: "Example typed into the create assignment form.",
    });

    const assignmentId = await getAssignmentIdByTitle(
      courseId,
      newAssignmentTitle,
    );
    await page.goto(`/student/courses/${courseId}`);

    // Guard: the page renders the seeded outline item, so the missing new
    // assignment below is the bug, not a broken page.
    await expect(
      page.locator(".card").filter({ hasText: "Outlined assignment" }),
    ).toHaveCount(1);

    // One card per outline item; the new assignment must be among them and
    // link to the student assignment page (like the seeded outline items).
    const assignmentCard = page
      .locator(".card")
      .filter({ hasText: newAssignmentTitle });
    await expect(assignmentCard).toHaveCount(1);
    const assignmentLink = assignmentCard.getByRole("link", {
      name: newAssignmentTitle,
    });
    await expect(assignmentLink).toBeVisible();
    await expect(assignmentLink).toHaveAttribute(
      "href",
      `/student/assignments/${assignmentId}`,
    );
  });
});
