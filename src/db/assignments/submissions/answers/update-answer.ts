import { db } from "@/db";
import { submissionAnswersTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function dbGradeSubmissionAnswer(data: {
  submissionId: number;
  questionId: number;
  isCorrect: boolean;
}) {
  const [updated] = await db
    .update(submissionAnswersTable)
    // Issue #88: grade through isCorrect only. The submission_answers
    // table has no points column.
    .set({
      isCorrect: data.isCorrect,
    })
    .where(
      and(
        eq(submissionAnswersTable.submissionId, data.submissionId),
        eq(submissionAnswersTable.questionId, data.questionId),
      ),
    )
    .returning();

  return updated;
}
