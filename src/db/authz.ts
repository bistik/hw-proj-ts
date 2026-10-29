import { db } from "@/db/";

export async function requireUserOwnsCourse(courseId: number, userId: string) {
  const course = await db.query.coursesTable.findFirst({
    where: (coursesTable, { and, eq }) =>
      and(eq(coursesTable.id, courseId), eq(coursesTable.authorId, userId)),
  });

  if (!course) {
    throw new Error("User is not the author of the course");
  }

  return course;
}

export async function requireUserEnrolledInCourse(
  courseId: number,
  studentId: string,
) {
  const enrollment = await db.query.enrollmentsTable.findFirst({
    where: (enrollmentsTable, { and, eq }) =>
      and(
        eq(enrollmentsTable.courseId, courseId),
        eq(enrollmentsTable.userId, studentId),
      ),
  });
  if (!enrollment) {
    throw new Error("User is not enrolled to the course");
  }

  return enrollment;
}
