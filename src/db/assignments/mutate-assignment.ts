import { db } from "@/db/";
import { assignmentsTable, courseItemsTable } from "../schema";
import { eq, max } from "drizzle-orm";

/**
 * Inserts the assignment row and its course_items outline row in one
 * transaction (issue #36). The student page /student/courses/<id> builds its
 * item list from course_items only (dbGetEnrollmentByCourseAndStudent in
 * src/db/courses/get-course.ts), so an assignment without an outline row is
 * invisible to students even though the author sees it on the assignments tab.
 */
export async function dbCreateAssignment(data: {
  title: string;
  courseId: number;
  example: string;
}) {
  return db.transaction(async (tx) => {
    const assignment = await tx
      .insert(assignmentsTable)
      .values({
        title: data.title,
        courseId: data.courseId,
        example: data.example || null,
      })
      .returning({ assignmentId: assignmentsTable.id })
      .then((res) => res[0]);

    // Next free outline position for this course: max(position) + 1, so the
    // new row does not collide with an existing position on the
    // course_items_course_position_unique index. max is null on an empty
    // outline, so the ?? -1 makes the first row take position 0.
    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(courseItemsTable.position) })
      .from(courseItemsTable)
      .where(eq(courseItemsTable.courseId, data.courseId));

    await tx.insert(courseItemsTable).values({
      courseId: data.courseId,
      itemType: "assignment",
      itemId: assignment.assignmentId,
      position: (maxPosition ?? -1) + 1,
    });

    return assignment;
  });
}

export async function dbUpdateAssignment(data: {
  title: string;
  assignmentId: number;
  example: string;
}) {
  const [updated] = await db
    .update(assignmentsTable)
    .set({ title: data.title, example: data.example || null })
    .where(eq(assignmentsTable.id, data.assignmentId))
    .returning();

  return updated ?? null;
}
