import { db } from "@/db/";
import { questionsTable } from "../schema";
import { eq } from "drizzle-orm";

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
