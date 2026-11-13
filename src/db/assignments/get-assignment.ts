import { db } from "@/db/";
import { assignmentsTable, coursesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function dbGetAssignment(assignmentId: number) {
  return db.query.assignmentsTable.findFirst({
    where: (assignmentsTable, { eq }) => eq(assignmentsTable.id, assignmentId),
  });
}

/**
 * Same row as dbGetAssignment, but scoped to the course author: the inner
 * join filters by author_id, so a non-author caller gets undefined instead
 * of the assignment (same guard shape as dbGetLesson and
 * dbGetQuestionByIdAndAuthor).
 */
export async function dbGetAssignmentByIdAndAuthor(
  assignmentId: number,
  authorId: string,
) {
  const result = await db
    .select({ assignment: assignmentsTable })
    .from(assignmentsTable)
    .innerJoin(coursesTable, eq(assignmentsTable.courseId, coursesTable.id))
    .where(
      and(
        eq(assignmentsTable.id, assignmentId),
        eq(coursesTable.authorId, authorId),
      ),
    )
    .limit(1);

  return result[0]?.assignment;
}

export async function dbGetAssignmentsByCourse(courseId: number) {
  return db.query.assignmentsTable.findMany({
    where: (assignmentsTable, { eq }) =>
      eq(assignmentsTable.courseId, courseId),
    orderBy: (assignmentsTable, { asc }) => [asc(assignmentsTable.id)],
  });
}
