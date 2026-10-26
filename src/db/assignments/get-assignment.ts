import { db } from "@/db/";

export async function dbGetAssignment(assignmentId: number) {
  return db.query.assignmentsTable.findFirst({
    where: (assignmentsTable, { eq }) => eq(assignmentsTable.id, assignmentId),
  });
}
