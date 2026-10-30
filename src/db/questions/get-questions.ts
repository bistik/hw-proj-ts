import { db } from "@/db/";
import { assignmentsTable, coursesTable, questionsTable } from "../schema";
import { and, asc, eq, gt, lt } from "drizzle-orm";

export async function dbGetQuestionsByAssignment(assignmentId: number) {
  return db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.assignmentId, assignmentId))
    .orderBy(asc(questionsTable.position));
}

export async function dbGetQuestionByIdAndAuthor(
  questionId: number,
  authorId: string,
) {
  const rows = await db
    .select({ question: questionsTable })
    .from(questionsTable)
    .innerJoin(
      assignmentsTable,
      eq(assignmentsTable.id, questionsTable.assignmentId),
    )
    .innerJoin(coursesTable, eq(coursesTable.id, assignmentsTable.courseId))
    .where(
      and(
        eq(questionsTable.id, questionId),
        eq(coursesTable.authorId, authorId),
      ),
    )
    .limit(1);

  return rows[0]?.question;
}

export async function dbGetQuestionsForStudent(assignmentId: number) {
  return db
    .select({
      id: questionsTable.id,
      questionText: questionsTable.questionText,
      position: questionsTable.position,
      assignmentId: questionsTable.assignmentId,
    })
    .from(questionsTable)
    .where(eq(questionsTable.assignmentId, assignmentId))
    .orderBy(asc(questionsTable.position));
}

export async function dbGetQuestionByIdAndAssignment(
  assignmentId: number,
  questionId: number,
) {
  return db.query.questionsTable.findFirst({
    columns: {
      id: true,
      questionText: true,
      assignmentId: true,
      position: true,
    },
    where: (questionsTable, { and, eq }) =>
      and(
        eq(questionsTable.assignmentId, assignmentId),
        eq(questionsTable.id, questionId),
      ),
  });
}

export async function dbGetNextQuestionByPosition(
  assignmentId: number,
  position: number,
) {
  return db.query.questionsTable.findFirst({
    columns: { id: true, questionText: true, assignmentId: true },
    where: (questionsTable, { and, eq }) =>
      and(
        eq(questionsTable.assignmentId, assignmentId),
        gt(questionsTable.position, position),
      ),
    orderBy: (questionsTable, { asc }) => [asc(questionsTable.position)],
  });
}

export async function dbGetPreviousQuestionByPosition(
  assignmentId: number,
  position: number,
) {
  return db.query.questionsTable.findFirst({
    columns: { id: true, questionText: true, assignmentId: true },
    where: (questionsTable, { and, eq }) =>
      and(
        eq(questionsTable.assignmentId, assignmentId),
        lt(questionsTable.position, position),
      ),
    orderBy: (questionsTable, { desc }) => [desc(questionsTable.position)],
  });
}
