import { db } from "@/db";
import {
  assignmentSubmissionsTable,
  assignmentsTable,
  enrollmentsTable,
  questionsTable,
  submissionAnswersTable,
  users,
} from "@/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

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

/**
 * Issue #41 guard: reports whether a student of the assignment's course
 * has not submitted the assignment — their submission row has no
 * submitted_at value, or they have no submission row at all. The helper
 * takes only the assignment id and derives the course by itself, so a
 * caller cannot scope the check to the wrong course.
 *
 * One query answers it: the inner join ties the enrollments of the
 * course to the assignment row, and the left join keeps every enrolled
 * student even without a submission row. isNull(submitted_at) then
 * matches both cases — a submission row without submitted_at, and no
 * submission row at all (the left join yields null there). A submitted
 * row filters out, so only the pending students survive.
 */
export async function dbHasUnsubmittedWork(assignmentId: number) {
  const pending = await db
    .select({ submissionId: assignmentSubmissionsTable.id })
    .from(enrollmentsTable)
    .innerJoin(
      assignmentsTable,
      eq(enrollmentsTable.courseId, assignmentsTable.courseId),
    )
    .leftJoin(
      assignmentSubmissionsTable,
      and(
        eq(assignmentSubmissionsTable.assignmentId, assignmentsTable.id),
        eq(assignmentSubmissionsTable.assigneeId, enrollmentsTable.userId),
      ),
    )
    .where(
      and(
        eq(assignmentsTable.id, assignmentId),
        isNull(assignmentSubmissionsTable.submittedAt),
      ),
    )
    .limit(1);

  return pending.length > 0;
}
