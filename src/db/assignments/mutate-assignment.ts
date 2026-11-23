import { db } from "@/db/";
import { assignmentsTable, courseItemsTable } from "../schema";
import { and, eq, max } from "drizzle-orm";

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

/**
 * Deletes the assignment row and its course_items outline row in one
 * transaction (issue #41). course_items has no foreign key on item_id
 * (lesson and assignment ids share one value space), so the database
 * cannot cascade the outline row: the app must delete it here, in the
 * same transaction, or the outline keeps pointing at a missing
 * assignment.
 *
 * The delete does not renumber the other outline rows: their positions
 * stay as they are (the course_items_course_position_unique index has
 * no collision with gaps).
 *
 * The where clauses scope both deletes to the course, so a caller that
 * mixed up course and assignment ids cannot delete rows of another
 * course. The questions, submissions, and submission answers go with
 * the assignment through the schema's foreign keys (database cascade).
 */
export const dbDeleteAssignment = async function (data: {
  courseId: number;
  assignmentId: number;
}) {
  return db.transaction(async (tx) => {
    await tx
      .delete(courseItemsTable)
      .where(
        and(
          eq(courseItemsTable.courseId, data.courseId),
          eq(courseItemsTable.itemType, "assignment"),
          eq(courseItemsTable.itemId, data.assignmentId),
        ),
      );

    const deleted = await tx
      .delete(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.id, data.assignmentId),
          eq(assignmentsTable.courseId, data.courseId),
        ),
      )
      .returning({ assignmentId: assignmentsTable.id });

    return deleted[0] ?? null;
  });
};
