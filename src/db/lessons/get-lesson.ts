import { eq, and, inArray } from "drizzle-orm";
import { db } from "..";
import {
  coursesTable,
  enrollmentsTable,
  lessonsTable,
} from "../schema";

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

/** One query for pages that need the lesson and its course's title
 * (breadcrumbs). The author check also guards non-authors. */
export async function dbGetLessonWithCourse(lessonId: number, userId: string) {
  const result = await db
    .select({ lesson: lessonsTable, courseTitle: coursesTable.title })
    .from(lessonsTable)
    .innerJoin(coursesTable, eq(lessonsTable.courseId, coursesTable.id))
    .where(
      and(eq(lessonsTable.id, lessonId), eq(coursesTable.authorId, userId)),
    )
    .limit(1);

  return result[0];
}

export async function dbGetLessonsByCourse(courseId: number) {
  return db.query.lessonsTable.findMany({
    where: (lessonsTable, { eq }) => eq(lessonsTable.courseId, courseId),
    orderBy: (lessonsTable, { asc }) => [asc(lessonsTable.id)],
  });
}

/** One query for the student lesson page (issue #38): the lesson and its
 * course's title (breadcrumbs). The join to the enrollment row also guards
 * non-enrolled students, with the same active/completed status filter the
 * student course page uses (dbGetEnrollmentByCourseAndStudent). */
export async function dbGetStudentLessonWithCourse(
  lessonId: number,
  studentId: string,
) {
  const result = await db
    .select({ lesson: lessonsTable, courseTitle: coursesTable.title })
    .from(lessonsTable)
    .innerJoin(coursesTable, eq(lessonsTable.courseId, coursesTable.id))
    .innerJoin(
      enrollmentsTable,
      and(
        eq(enrollmentsTable.courseId, coursesTable.id),
        eq(enrollmentsTable.userId, studentId),
        inArray(enrollmentsTable.status, ["active", "completed"]),
      ),
    )
    .where(eq(lessonsTable.id, lessonId))
    .limit(1);

  return result[0];
}
