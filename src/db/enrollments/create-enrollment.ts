import { db } from "@/db/";
import { users } from "../auth-schema";
import { coursesTable, enrollmentsTable } from "../schema";
import { eq } from "drizzle-orm";

export async function dbCreateEnrollment(data: {
  userId: string;
  courseId: number;
}) {
  const inserted = await db
    .insert(enrollmentsTable)
    .values({ ...data, status: "invited" })
    .onConflictDoNothing({
      target: [enrollmentsTable.userId, enrollmentsTable.courseId],
    })
    .returning({ id: enrollmentsTable.id });

  return { created: inserted.length > 0, id: inserted[0]?.id ?? null };
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
