import { db } from "@/db/";

export async function dbGetAssignment(assignmentId: number) {
  return db.query.assignmentsTable.findFirst({
    where: (assignmentsTable, { eq }) => eq(assignmentsTable.id, assignmentId),
  });
}

export async function dbGetAssignmentsByCourse(courseId: number) {
  return db.query.assignmentsTable.findMany({
    where: (assignmentsTable, { eq }) =>
      eq(assignmentsTable.courseId, courseId),
    orderBy: (assignmentsTable, { asc }) => [asc(assignmentsTable.id)],
  });
}
