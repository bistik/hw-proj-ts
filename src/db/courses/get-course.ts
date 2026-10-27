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

export async function dbGetCompleteCourseByUser(authorId: string) {
  return db.query.coursesTable.findMany({
    where: (coursesTable, { eq }) => eq(coursesTable.authorId, authorId),
    with: {
      lessons: { columns: { id: true, title: true } },
      assignments: { columns: { id: true, title: true } },
    },
    orderBy: (coursesTable, { desc }) => desc(coursesTable.id),
    limit: 50,
  });
}

export async function dbGetEnrolledCourses(studentId: string) {
  return db.query.enrollmentsTable.findMany({
    where: (enrollmentsTable, { eq }) => eq(enrollmentsTable.userId, studentId),
    with: {
      course: { columns: { id: true, title: true, description: true } },
    },
    orderBy: (enrollmentsTable, { desc }) => desc(enrollmentsTable.enrolledAt),
    limit: 50,
  });
}
