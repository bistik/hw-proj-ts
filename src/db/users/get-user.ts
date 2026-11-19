import { db } from "@/db/";
import { users } from "../auth-schema";
import { enrollmentsTable } from "../schema";
import { and, desc, eq, notExists } from "drizzle-orm";

/**
 * The registered user owning an email address, or null. Emails are matched
 * normalized (trim + lowercase), the same rule the invites table applies.
 * The course-author invite flow uses this to turn an email-only invite into
 * a real enrollment when the address belongs to an existing account.
 */
export async function dbGetUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return user ?? null;
}

/**
 * Users who are not enrolled in the given course. Drives the Enroll-a-student
 * dropdown so already-enrolled users are never offered again. The exclusion
 * runs in SQL (NOT EXISTS) instead of being filtered in application code.
 */
export async function dbGetUnenrolledUsers(courseId: number) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      notExists(
        db
          .select()
          .from(enrollmentsTable)
          .where(
            and(
              eq(enrollmentsTable.courseId, courseId),
              eq(enrollmentsTable.userId, users.id),
            ),
          ),
      ),
    )
    .orderBy(desc(users.id))
    .limit(50);
}
