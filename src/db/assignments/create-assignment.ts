import { db } from "@/db/";
import { assignmentsTable } from "../schema";

export async function dbCreateAssignment(data: {
  title: string;
  courseId: number;
}) {
  try {
    await db.insert(assignmentsTable).values(data);
    return true;
  } catch (err) {
    console.error("Error in inserting assignment record", err);
    return false;
  }
}
