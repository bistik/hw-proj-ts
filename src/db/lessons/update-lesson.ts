import { eq } from "drizzle-orm";
import { lessonsTable } from "../schema";
import { db } from "@/db/";

export async function dbUpdateLesson(
  data: { title: string; content: string },
  lessonId: number,
) {
  return db
    .update(lessonsTable)
    .set(data)
    .where(eq(lessonsTable.id, lessonId))
    .returning()
    .then((res) => res[0]);
}
