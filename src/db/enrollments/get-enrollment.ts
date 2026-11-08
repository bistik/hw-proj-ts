import { db } from "@/db/";

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
