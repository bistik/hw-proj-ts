import { db } from "@/db";
import { questionsTable, submissionAnswersTable } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export async function dbGetSubmissionByAssignmentAndStudent(
  assignmentId: number,
  assigneeId: string,
) {
  const submission = await db.query.assignmentSubmissionsTable.findFirst({
    where: (assignmentSubmissionsTable, { and, eq }) =>
      and(
        eq(assignmentSubmissionsTable.assignmentId, assignmentId),
        eq(assignmentSubmissionsTable.assigneeId, assigneeId),
      ),
  });

  if (!submission) {
    return { submission: null, questions: [] };
  }

  const rows = await db
    .select({
      id: questionsTable.id,
      position: questionsTable.position,
      questionText: questionsTable.questionText,
      answerId: submissionAnswersTable.id,
    })
    .from(questionsTable)
    .leftJoin(
      submissionAnswersTable,
      and(
        eq(submissionAnswersTable.questionId, questionsTable.id),
        eq(submissionAnswersTable.submissionId, submission.id),
      ),
    )
    .where(eq(questionsTable.assignmentId, assignmentId))
    .orderBy(asc(questionsTable.position));

  // TODO: `submission` is not consumed yet; it will be used soon when the
  // author-submitted answers are reviewed by the assignment author.
  return {
    submission,
    questions: rows.map((q) => ({ ...q, answered: q.answerId !== null })),
  };
}
