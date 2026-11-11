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
    .set({
      isCorrect: data.isCorrect,
      points: data.isCorrect ? 1 : 0,
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
