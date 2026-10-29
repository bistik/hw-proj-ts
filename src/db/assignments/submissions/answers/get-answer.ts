import { db } from "@/db";

export async function dbGetSubmissionAnswer(data: {
  assignmentId: number;
  questionId: number;
  assigneeId: string;
}) {
  const submission = await db.query.assignmentSubmissionsTable.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.assignmentId, data.assignmentId), eq(t.assigneeId, data.assigneeId)),
  });

  if (!submission) return null;

  return db.query.submissionAnswersTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.submissionId, submission.id),
        eq(t.questionId, data.questionId),
      ),
  });
}
