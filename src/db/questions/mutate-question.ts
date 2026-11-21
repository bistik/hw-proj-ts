import { max, eq } from "drizzle-orm";
import { db } from "@/db/";
import { questionsTable } from "../schema";

export async function dbCreateQuestion(data: {
  questionText: string;
  answer: string;
  assignmentId: number;
}) {
  // next position = highest existing position for this assignment + 1
  const [{ maxPosition }] = await db
    .select({ maxPosition: max(questionsTable.position) })
    .from(questionsTable)
    .where(eq(questionsTable.assignmentId, data.assignmentId));

  return db
    .insert(questionsTable)
    .values({ ...data, position: (maxPosition ?? -1) + 1 })
    .returning({ questionId: questionsTable.id })
    .then((res) => res[0]);
}

/**
 * Inserts every question item in one transaction (issue #73). The
 * positions start after the highest existing position of the assignment,
 * then increase by one in input order. A failure rolls back the whole
 * insert, so the assignment never keeps a partial list of questions.
 */
export async function dbCreateQuestions(data: {
  assignmentId: number;
  questions: {
    questionText: string;
    answer: string;
  }[];
}) {
  return db.transaction(async (tx) => {
    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(questionsTable.position) })
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, data.assignmentId));

    return tx
      .insert(questionsTable)
      .values(
        data.questions.map((question, index) => ({
          ...question,
          assignmentId: data.assignmentId,
          position: (maxPosition ?? -1) + 1 + index,
        })),
      )
      .returning({ questionId: questionsTable.id });
  });
}

export async function dbUpdateQuestion(
  data: {
    questionText: string;
    answer: string;
  },
  questionId: number,
) {
  return db
    .update(questionsTable)
    .set(data)
    .where(eq(questionsTable.id, questionId))
    .returning()
    .then((res) => res[0]);
}

// The delete also removes the question's submission_answers rows through
// the submission_answers.question_id foreign key, which references
// questions.id (onDelete: "cascade"), so a deleted question cannot leave
// orphaned answers behind.
export async function dbDeleteQuestion(questionId: number) {
  return db
    .delete(questionsTable)
    .where(eq(questionsTable.id, questionId))
    .returning()
    .then((res) => res[0]);
}
