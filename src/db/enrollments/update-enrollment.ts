import { db } from "@/db/";
import { enrollmentsTable } from "../schema";
import { and, eq } from "drizzle-orm";

/**
 * Moves a student's enrollment out of the "invited" state: accepting sets it
 * "active" (and stamps enrolled_at with the accept time), declining sets it
 * "declined". Scoped to the caller's own row and only while it is still
 * "invited", so accepting/declining twice or touching an already-active
 * enrollment is a no-op. Returns the updated row, or null when nothing
 * changed (e.g. the invitation was already handled).
 */
export async function dbUpdateEnrollmentStatus(data: {
  userId: string;
  courseId: number;
  status: "active" | "declined";
}) {
  const [updated] = await db
    .update(enrollmentsTable)
    .set(
      data.status === "active"
        ? { status: "active", enrolledAt: new Date() }
        : { status: "declined" },
    )
    .where(
      and(
        eq(enrollmentsTable.userId, data.userId),
        eq(enrollmentsTable.courseId, data.courseId),
        eq(enrollmentsTable.status, "invited"),
      ),
    )
    .returning({ courseId: enrollmentsTable.courseId });

  return updated ?? null;
}
