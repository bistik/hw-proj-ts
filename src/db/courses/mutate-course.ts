import { db } from "@/db/";
import { coursesTable } from "../schema";
import { and, eq } from "drizzle-orm";

export async function dbCreateCourse(data: {
  title: string;
  description: string;
  authorId: string;
}) {
  return db
    .insert(coursesTable)
    .values(data)
    .returning({ courseId: coursesTable.id })
    .then((res) => res[0]);
}

export async function dbUpdateCourse(data: {
  courseId: number;
  title: string;
  description: string;
  authorId: string;
}) {
  try {
    const result = await db
      .update(coursesTable)
      .set({ title: data.title, description: data.description })
      .where(
        and(
          eq(coursesTable.id, data.courseId),
          eq(coursesTable.authorId, data.authorId),
        ),
      )
      .returning({ courseId: coursesTable.id });
    return result[0] ?? null;
  } catch (err) {
    console.error(
      `Error updating course ${data.courseId} for user ${data.authorId}`,
      err,
    );
    return null;
  }
}
