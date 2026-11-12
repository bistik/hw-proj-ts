import { db } from "@/db";
import { assignmentSubmissionsTable } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Marks a submission as completed (review closed) by setting completed_at.
 *
 * Idempotent: when completed_at is already set, the where clause matches
 * no row, so the original completion time is never overwritten. The
 * update then returns undefined, and the caller decides what to return.
 *
 * Returns the updated row, or undefined when no submission has the id or
 * the submission is already completed.
 */
export async function dbCompleteSubmission(submissionId: number) {
  const [updated] = await db
    .update(assignmentSubmissionsTable)
    .set({ completedAt: new Date() })
    .where(
      and(
        eq(assignmentSubmissionsTable.id, submissionId),
        isNull(assignmentSubmissionsTable.completedAt),
      ),
    )
    .returning({
      id: assignmentSubmissionsTable.id,
      completedAt: assignmentSubmissionsTable.completedAt,
    });

  return updated;
}
