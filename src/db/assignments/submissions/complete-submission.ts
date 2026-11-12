import { db } from "@/db";
import { assignmentSubmissionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Marks a submission as completed (review closed) by setting completed_at.
 *
 * Idempotent: calling it again on an already-completed submission just
 * refreshes the timestamp, so a double click (or a retried request while
 * the page re-renders) stays harmless.
 *
 * Returns the updated row, or undefined when no submission has the id.
 */
export async function dbCompleteSubmission(submissionId: number) {
  const [updated] = await db
    .update(assignmentSubmissionsTable)
    .set({ completedAt: new Date() })
    .where(eq(assignmentSubmissionsTable.id, submissionId))
    .returning({
      id: assignmentSubmissionsTable.id,
      completedAt: assignmentSubmissionsTable.completedAt,
    });

  return updated;
}
