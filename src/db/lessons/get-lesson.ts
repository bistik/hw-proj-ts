import { eq, and } from "drizzle-orm";
import { db } from "..";
import { coursesTable, lessonsTable } from "../schema";

export async function dbGetLesson(lessonId: number, userId: string) {
  const result = await db
    .select({ lesson: lessonsTable })
    .from(lessonsTable)
    .innerJoin(coursesTable, eq(lessonsTable.courseId, coursesTable.id))
    .where(
      and(eq(lessonsTable.id, lessonId), eq(coursesTable.authorId, userId)),
    )
    .limit(1);

  return result[0]?.lesson;
}

export async function dbGetLessonsByCourse(courseId: number) {
  return db.query.lessonsTable.findMany({
    where: (lessonsTable, { eq }) => eq(lessonsTable.courseId, courseId),
    orderBy: (lessonsTable, { asc }) => [asc(lessonsTable.id)],
  });
}
