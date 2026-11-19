import { db } from "@/db/";
import { coursesTable, invitesTable } from "../schema";
import { asc, eq } from "drizzle-orm";

/**
 * Pending invitations for an email address, joined to the course title. The
 * sign-up hook (src/lib/auth.ts) converts each row into an enrollment for
 * the freshly created user, so the dashboard's invitation flow picks it up.
 */
export async function dbGetPendingInvitesByEmail(email: string) {
  return db
    .select({
      id: invitesTable.id,
      courseId: invitesTable.courseId,
      courseTitle: coursesTable.title,
    })
    .from(invitesTable)
    .innerJoin(coursesTable, eq(coursesTable.id, invitesTable.courseId))
    .where(eq(invitesTable.email, email.trim().toLowerCase()))
    .orderBy(asc(invitesTable.id));
}
