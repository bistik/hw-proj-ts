import { db } from "@/db/";
import { assignmentsTable } from "../schema";
import { eq } from "drizzle-orm";

export async function dbCreateAssignment(data: {
  title: string;
  courseId: number;
  example: string;
}) {
  return db
    .insert(assignmentsTable)
    .values({
      title: data.title,
      courseId: data.courseId,
      example: data.example || null,
    })
    .returning({ assignmentId: assignmentsTable.id })
    .then((res) => res[0]);
}

export async function dbUpdateAssignment(data: {
  title: string;
  assignmentId: number;
  example: string;
}) {
  const [updated] = await db
    .update(assignmentsTable)
    .set({ title: data.title, example: data.example || null })
    .where(eq(assignmentsTable.id, data.assignmentId))
    .returning();

  return updated ?? null;
}
