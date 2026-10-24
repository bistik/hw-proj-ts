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
    console.error(`Error retrieving course records for user ${authorId}`, err);
    return null;
  }
}

export async function dbGetCourseByIdAndAuthor(
  courseId: number,
  authorId: string,
) {
  try {
    const course = await db.query.coursesTable.findFirst({
      where: (coursesTable, { and, eq }) =>
        and(eq(coursesTable.id, courseId), eq(coursesTable.authorId, authorId)),
    });
    return course;
  } catch (err) {
    console.error(
      `Error retrieving course ${courseId} for user ${authorId}`,
      err,
    );
    return null;
  }
}
