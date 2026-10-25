import { db } from "@/db/";
import { assignmentsTable } from "../schema";

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
