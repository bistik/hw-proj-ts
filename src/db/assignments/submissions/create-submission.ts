import { db } from "@/db/";
import { assignmentSubmissionsTable } from "@/db/schema";

export async function dbCreateSubmission(data: {
  assignmentId: number;
  assigneeId: string;
}) {
  const [created] = await db
    .insert(assignmentSubmissionsTable)
    .values(data)
    .onConflictDoNothing({
      target: [
        assignmentSubmissionsTable.assignmentId,
        assignmentSubmissionsTable.assigneeId,
      ],
    })
    .returning();

  if (created) return created;

  return db.query.assignmentSubmissionsTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.assignmentId, data.assignmentId),
        eq(t.assigneeId, data.assigneeId),
      ),
  });
}
