import { db } from "@/db/";
import { enrollmentsTable, invitesTable } from "../schema";
import { eq } from "drizzle-orm";

/**
 * Records a pending invitation for an email address that belongs to no
 * registered user yet (issue #31). The sign-up hook (src/lib/auth.ts)
 * converts the row into an enrollment once a user signs up with this
 * address — rows are only ever inserted and deleted, never updated.
 *
 * The unique (course, email) index makes a re-invite a no-op instead of a
 * duplicate row, the same rule the enrollments table applies to re-enrolls.
 * The returned flag lets the caller skip the invite email for a no-op
 * re-invite, the same behavior a repeated invite of a registered student
 * gets.
 */
export async function dbCreateInvite(data: { courseId: number; email: string }) {
  const inserted = await db
    .insert(invitesTable)
    .values({
      courseId: data.courseId,
      email: data.email.trim().toLowerCase(),
    })
    .onConflictDoNothing({
      target: [invitesTable.courseId, invitesTable.email],
    })
    .returning({ id: invitesTable.id });

  return { created: inserted.length > 0, id: inserted[0]?.id ?? null };
}

/**
 * Converts one pending invite into an enrollment in one transaction, so the
 * invite cannot convert twice: the enrollment insert and the invite delete
 * either both land, or neither does. A stale invite (the user is already
 * enrolled, so the insert no-ops) is still deleted. The sign-up hook calls
 * this once per invite and catches failures, so one failing invite does not
 * block the others.
 */
export async function dbConvertInviteToEnrollment(
  invite: { id: number; courseId: number },
  userId: string,
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(enrollmentsTable)
      .values({ courseId: invite.courseId, userId, status: "invited" })
      .onConflictDoNothing({
        target: [enrollmentsTable.userId, enrollmentsTable.courseId],
      });

    await tx.delete(invitesTable).where(eq(invitesTable.id, invite.id));
  });
}
