import { db } from "@/db/";
import { enrollmentsTable } from "../schema";

export async function dbCreateEnrollment(data: {
  userId: string;
  courseId: number;
}) {
  const inserted = await db
    .insert(enrollmentsTable)
    .values(data)
    .onConflictDoNothing({
      target: [enrollmentsTable.userId, enrollmentsTable.courseId],
    })
    .returning({ id: enrollmentsTable.id });

  return { created: inserted.length > 0, id: inserted[0]?.id ?? null };
}
