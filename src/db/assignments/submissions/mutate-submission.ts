import { db } from "@/db/";
import { assignmentSubmissionsTable } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

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

/**
 * Sets submitted_at = NOW() on the student's assignment submission, but only
 * while it is still null; already-submitted submissions no-op.
 * Returns the updated row, or undefined when nothing was updated.
 */
export async function dbSetSubmissionToNow(data: {
  assignmentId: number;
  assigneeId: string;
}) {
  const [updated] = await db
    .update(assignmentSubmissionsTable)
    .set({ submittedAt: sql`unixepoch('now')` })
    .where(
      and(
        eq(assignmentSubmissionsTable.assignmentId, data.assignmentId),
        eq(assignmentSubmissionsTable.assigneeId, data.assigneeId),
        isNull(assignmentSubmissionsTable.submittedAt),
      ),
    )
    .returning();

  return updated;
}
