import { db } from ".";

export async function requireUserOwnsCourse(courseId: number, userId: string) {
  const course = await db.query.coursesTable.findFirst({
    where: (coursesTable, { and, eq }) =>
      and(eq(coursesTable.id, courseId), eq(coursesTable.authorId, userId)),
  });

  if (!course) {
    throw new Error("Not found");
  }

  return course;
}
