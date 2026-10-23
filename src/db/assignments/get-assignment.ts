import { db } from "@/db/";

export async function dbGetAssignment(assignmentId: number) {
  try {
    const assignment = await db.query.assignmentsTable.findFirst({
      where: (assignmentsTable, { eq }) =>
        eq(assignmentsTable.id, assignmentId),
    });
    return assignment;
  } catch (err) {
    console.error(`Error fetching assignment with id ${assignmentId}`, err);
    return undefined;
  }
}
