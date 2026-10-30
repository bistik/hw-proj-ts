import { db } from "@/db/";
import { assignmentsTable } from "../schema";
import { eq } from "drizzle-orm";

export async function dbCreateAssignment(data: {
  title: string;
  courseId: number;
}) {
  return db
    .insert(assignmentsTable)
    .values(data)
    .returning({ assignmentId: assignmentsTable.id })
    .then((res) => res[0]);
}

export async function dbUpdateAssignment(data: {
  title: string;
  assignmentId: number;
}) {
  const [updated] = await db
    .update(assignmentsTable)
    .set({ title: data.title })
    .where(eq(assignmentsTable.id, data.assignmentId))
    .returning();

  return updated ?? null;
}
