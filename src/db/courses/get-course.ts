import { db } from "@/db/";
import { coursesTable } from "../schema";
import { desc, eq } from "drizzle-orm";

export async function dbGetCoursesByUser(authorId: string) {
  try {
    const result = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.authorId, authorId))
      .orderBy(desc(coursesTable.id))
      .limit(50);
    return result;
  } catch (err) {
    console.error("Error inserting new course record", err);
    return false;
  }
}
