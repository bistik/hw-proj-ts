import { db } from "@/db/";
import { assignmentSubmissionsTable, submissionAnswersTable } from "@/db/schema";
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

/**
 * The student's submit action (issue #95). Marks the caller's
 * submission submitted (same rule as dbSetSubmissionToNow) and, when
 * the assignment's check_on_submit toggle is on, grades every saved
 * answer of that submission: an answer is correct when its text equals
 * the question's correct answer after trimming surrounding whitespace.
 *
 * The return value drives the student's score modal:
 * - { checked: true, score, total } for a stored-on assignment. The
 *   total counts every question of the assignment; the score counts
 *   the correct answers. An unanswered question has no answer row, so
 *   it contributes no score but still counts into the total.
 * - { checked: false, score: null, total: null } for a stored-off one:
 *   the plain submit keeps the answers ungraded.
 */
export async function dbSubmitAssignment(data: {
  assignmentId: number;
  assigneeId: string;
}): Promise<
  | { checked: true; score: number; total: number }
  | { checked: false; score: null; total: null }
> {
  await dbSetSubmissionToNow(data);

  const assignment = await db.query.assignmentsTable.findFirst({
    where: (t, { eq }) => eq(t.id, data.assignmentId),
  });
  if (!assignment?.checkOnSubmit) {
    return { checked: false, score: null, total: null };
  }

  // Every question of the assignment counts into the total, answered
  // or not.
  const questions = await db.query.questionsTable.findMany({
    where: (t, { eq }) => eq(t.assignmentId, data.assignmentId),
  });
  const correctAnswers = new Map(
    questions.map((question) => [question.id, question.answer]),
  );

  const submission = await db.query.assignmentSubmissionsTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.assignmentId, data.assignmentId),
        eq(t.assigneeId, data.assigneeId),
      ),
  });
  if (!submission) {
    return { checked: true, score: 0, total: questions.length };
  }

  const answers = await db.query.submissionAnswersTable.findMany({
    where: (t, { eq }) => eq(t.submissionId, submission.id),
  });

  let score = 0;
  for (const answer of answers) {
    const correctAnswer =
      answer.questionId === null
        ? undefined
        : correctAnswers.get(answer.questionId);
    // An answer row without a question of this assignment has nothing
    // to check: leave it ungraded.
    if (correctAnswer === undefined) continue;

    const isCorrect = answer.answer.trim() === correctAnswer.trim();
    if (isCorrect) score += 1;
    await db
      .update(submissionAnswersTable)
      .set({ isCorrect })
      .where(eq(submissionAnswersTable.id, answer.id));
  }

  return { checked: true, score, total: questions.length };
}
