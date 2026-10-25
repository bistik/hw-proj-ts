import { db } from "@/db/";
import { questionsTable } from "../schema";

export async function dbCreateQuestion(data: {
  questionText: string;
  answer: string;
  assignmentId: number;
}) {
  return db
    .insert(questionsTable)
    .values(data)
    .returning({ questionId: questionsTable.id })
    .then((res) => res[0]);
}
