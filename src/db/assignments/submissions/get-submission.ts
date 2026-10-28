import { db } from "@/db";

export async function dbGetSubmissionByAssignmentAndStudent(
  assignmentId: number,
  assigneeId: string,
) {
  return db.query.assignmentSubmissionsTable.findFirst({
    where: (assignmentSubmissionsTable, { and, eq }) =>
      and(
        eq(assignmentSubmissionsTable.assignmentId, assignmentId),
        eq(assignmentSubmissionsTable.assigneeId, assigneeId),
      ),
  });
}
