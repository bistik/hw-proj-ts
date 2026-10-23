import { db } from "..";
import { questionsTable } from "../schema";

export async function dbCreateQuestion(data: {
  questionText: string;
  answer: string;
  assignmentId: number;
}) {
  try {
    await db.insert(questionsTable).values(data);
    return true;
  } catch (err) {
    console.error("Error in inserting question record", err);
    return false;
  }
}
