import { db } from "@/db/";
import { assignmentsTable, coursesTable, lessonsTable } from "../schema";
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

/**
 * The author's courses with lesson/assignment counts. Each count is a
 * correlated subquery (not joins — joining both tables would multiply rows
 * and skew counts) computed directly from the lessons/assignments tables,
 * so items missing from the course_items outline are still counted.
 * Zero-count courses keep both "0 assignments"/"0 lessons" links.
 */
export async function dbGetCoursesWithItemCountsByUser(authorId: string) {
  return db
    .select({
      id: coursesTable.id,
      title: coursesTable.title,
      description: coursesTable.description,
      lessonCount: db.$count(
        lessonsTable,
        eq(lessonsTable.courseId, coursesTable.id),
      ),
      assignmentCount: db.$count(
        assignmentsTable,
        eq(assignmentsTable.courseId, coursesTable.id),
      ),
    })
    .from(coursesTable)
    .where(eq(coursesTable.authorId, authorId))
    .orderBy(desc(coursesTable.id))
    .limit(50);
}

export async function dbGetEnrolledCourses(studentId: string) {
  return db.query.enrollmentsTable.findMany({
    where: (enrollmentsTable, { and, eq, inArray }) =>
      and(
        eq(enrollmentsTable.userId, studentId),
        inArray(enrollmentsTable.status, ["active", "completed"]),
      ),
    with: {
      course: { columns: { id: true, title: true, description: true } },
    },
    orderBy: (enrollmentsTable, { desc }) => desc(enrollmentsTable.enrolledAt),
    limit: 50,
  });
}

export async function dbGetEnrollmentByCourseAndStudent(
  courseId: number,
  studentId: string,
) {
  return db.query.enrollmentsTable.findFirst({
    where: (enrollmentsTable, { and, eq, inArray }) =>
      and(
        eq(enrollmentsTable.courseId, courseId),
        eq(enrollmentsTable.userId, studentId),
        inArray(enrollmentsTable.status, ["active", "completed"]),
      ),
    with: {
      course: {
        with: {
          lessons: { columns: { id: true, title: true } },
          assignments: { columns: { id: true, title: true } },
        },
      },
    },
  });
}
