import { db } from "@/db/";
import { questionsTable } from "../schema";
import { desc, eq } from "drizzle-orm";

export async function dbGetQuestionsByAssignment(assignmentId: number) {
  try {
    const result = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, assignmentId))
      .orderBy(desc(questionsTable.id));
    return result;
  } catch (err) {
    console.error(
      `Error in fetching questions for assignment ${assignmentId}`,
      err,
    );
    return null;
  }
}
