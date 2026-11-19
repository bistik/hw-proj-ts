import { db } from "@/db/";
import { invitesTable } from "../schema";

/**
 * Records a pending invitation for an email address that belongs to no
 * registered user yet (issue #31). The sign-up hook (src/lib/auth.ts)
 * converts the row into an enrollment once a user signs up with this
 * address, and deletes it afterwards — rows are only ever inserted and
 * deleted, never updated.
 *
 * The unique (course, email) index makes a re-invite a no-op instead of a
 * duplicate row, the same rule the enrollments table applies to re-enrolls.
 */
export async function dbCreateInvite(data: { courseId: number; email: string }) {
  await db
    .insert(invitesTable)
    .values({
      courseId: data.courseId,
      email: data.email.trim().toLowerCase(),
    })
    .onConflictDoNothing({
      target: [invitesTable.courseId, invitesTable.email],
    });
}
