import { db } from "@/db/";
import {
  assignmentSubmissionsTable,
  assignmentsTable,
  coursesTable,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

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

/**
 * Verifies in one query that the submission exists, belongs to the given
 * course, and that course belongs to the caller — the same guard shape as
 * requireUserOwnsCourse, scoped one level deeper.
 *
 * Throws when any of the three fails, so server fns can follow up with
 * state checks (e.g. "already submitted?") without another db round-trip.
 */
export async function requireUserOwnsSubmission(
  submissionId: number,
  courseId: number,
  userId: string,
) {
  const [submission] = await db
    .select({
      id: assignmentSubmissionsTable.id,
      submittedAt: assignmentSubmissionsTable.submittedAt,
      completedAt: assignmentSubmissionsTable.completedAt,
    })
    .from(assignmentSubmissionsTable)
    .innerJoin(
      assignmentsTable,
      eq(assignmentSubmissionsTable.assignmentId, assignmentsTable.id),
    )
    .innerJoin(coursesTable, eq(assignmentsTable.courseId, coursesTable.id))
    .where(
      and(
        eq(assignmentSubmissionsTable.id, submissionId),
        eq(coursesTable.id, courseId),
        eq(coursesTable.authorId, userId),
      ),
    )
    .limit(1);

  if (!submission) {
    throw new Error("Submission not found");
  }

  return submission;
}

export async function requireUserEnrolledInCourse(
  courseId: number,
  studentId: string,
) {
  const enrollment = await db.query.enrollmentsTable.findFirst({
    where: (enrollmentsTable, { and, eq, inArray }) =>
      and(
        eq(enrollmentsTable.courseId, courseId),
        eq(enrollmentsTable.userId, studentId),
        inArray(enrollmentsTable.status, ["active", "completed"]),
      ),
  });
  if (!enrollment) {
    throw new Error("User is not enrolled to the course");
  }

  return enrollment;
}
