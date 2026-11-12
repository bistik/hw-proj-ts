import { db } from "@/db";
import {
  assignmentSubmissionsTable,
  assignmentsTable,
  questionsTable,
  submissionAnswersTable,
  users,
} from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

export async function dbGetSubmissionsByCourse(courseId: number) {
  return (
    db
      .select({
        id: assignmentSubmissionsTable.id,
        assignmentId: assignmentsTable.id,
        assignmentTitle: assignmentsTable.title,
        assigneeName: users.name,
        assigneeEmail: users.email,
        startedAt: assignmentSubmissionsTable.startedAt,
        submittedAt: assignmentSubmissionsTable.submittedAt,
      })
      .from(assignmentSubmissionsTable)
      .innerJoin(
        assignmentsTable,
        eq(assignmentSubmissionsTable.assignmentId, assignmentsTable.id),
      )
      .innerJoin(users, eq(assignmentSubmissionsTable.assigneeId, users.id))
      .where(eq(assignmentsTable.courseId, courseId))
      // Newest submissions first; id breaks ties between identical timestamps.
      .orderBy(
        desc(assignmentSubmissionsTable.startedAt),
        desc(assignmentSubmissionsTable.id),
      )
  );
}

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

export async function dbGetSubmissionForReview(submissionId: number) {
  const submission = await db.query.assignmentSubmissionsTable.findFirst({
    where: (t, { eq }) => eq(t.id, submissionId),
    columns: {
      id: true,
      assignmentId: true,
      assigneeId: true,
      startedAt: true,
      submittedAt: true,
      completedAt: true,
    },
    with: {
      assignment: {
        columns: { id: true, courseId: true },
        with: {
          course: { columns: { title: true } },
        },
      },
    },
  });

  if (!submission) return null;

  const [assignee] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, submission.assigneeId))
    .limit(1);

  const questions = await db
    .select({
      id: questionsTable.id,
      position: questionsTable.position,
      questionText: questionsTable.questionText,
      correctAnswer: questionsTable.answer,
      studentAnswer: submissionAnswersTable.answer,
      isCorrect: submissionAnswersTable.isCorrect,
    })
    .from(questionsTable)
    .innerJoin(
      assignmentSubmissionsTable,
      eq(
        questionsTable.assignmentId,
        assignmentSubmissionsTable.assignmentId,
      ),
    )
    .leftJoin(
      submissionAnswersTable,
      and(
        eq(submissionAnswersTable.questionId, questionsTable.id),
        eq(submissionAnswersTable.submissionId, submissionId),
      ),
    )
    .where(eq(assignmentSubmissionsTable.id, submissionId))
    .orderBy(asc(questionsTable.position));

  return { submission, assignee, questions };
}
