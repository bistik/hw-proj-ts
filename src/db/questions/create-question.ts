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
