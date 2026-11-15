import { db } from "@/db/";
import { users } from "../auth-schema";
import { coursesTable } from "../schema";
import { eq } from "drizzle-orm";

/**
 * Lists a course's enrollees, each joined to the user's public identity
 * (id/name/email) so the author-facing roster can render who is enrolled.
 */
export async function dbGetEnrolleesByCourse(courseId: number) {
  return db.query.enrollmentsTable.findMany({
    where: (enrollmentsTable, { eq }) =>
      eq(enrollmentsTable.courseId, courseId),
    with: {
      user: { columns: { id: true, name: true, email: true } },
    },
    orderBy: (enrollmentsTable, { asc }) => [asc(enrollmentsTable.id)],
  });
}

/**
 * Lists a student's pending course invitations — enrollment rows still in the
 * "invited" state — joined to the course title so the dashboard can render an
 * accept/decline prompt.
 */
export async function dbGetInvitationsByStudent(studentId: string) {
  return db.query.enrollmentsTable.findMany({
    where: (enrollmentsTable, { and, eq }) =>
      and(
        eq(enrollmentsTable.userId, studentId),
        eq(enrollmentsTable.status, "invited"),
      ),
    with: {
      course: { columns: { id: true, title: true } },
    },
    orderBy: (enrollmentsTable, { asc }) => [asc(enrollmentsTable.id)],
  });
}

/**
 * Student and course details for the invitation email. Only called right
 * after a fresh enrollment row was created, so a missing row is unexpected:
 * it returns null instead of throwing and the send is skipped.
 */
export async function dbGetInviteContext(data: {
  courseId: number;
  userId: string;
}) {
  const [row] = await db
    .select({
      studentEmail: users.email,
      studentName: users.name,
      courseTitle: coursesTable.title,
    })
    .from(users)
    .innerJoin(coursesTable, eq(coursesTable.id, data.courseId))
    .where(eq(users.id, data.userId))
    .limit(1);

  return row ?? null;
}
