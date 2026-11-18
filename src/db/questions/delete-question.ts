import { db } from "@/db/";
import { questionsTable } from "../schema";
import { eq } from "drizzle-orm";

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
