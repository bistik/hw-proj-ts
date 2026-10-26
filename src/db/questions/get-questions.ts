import { db } from "@/db/";
import { assignmentsTable, coursesTable, questionsTable } from "../schema";
import { and, desc, eq } from "drizzle-orm";

export async function dbGetQuestionsByAssignment(assignmentId: number) {
  return db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.assignmentId, assignmentId))
    .orderBy(desc(questionsTable.id));
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
