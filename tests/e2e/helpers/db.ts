import { createClient } from "@libsql/client";

// The same local libsql file the E2E webServer points at
// (see playwright.config.ts). Lets tests touch seeded rows directly, e.g.
// for flags the app expects but no signup API path sets.
const client = createClient({
  url: "file:./tests/e2e/e2e-test.db",
});

/**
 * Marks a user's email as verified in the e2e database.
 *
 * The /_authenticated/courses layout gate (src/routes/_authenticated/courses/
 * route.tsx) rejects unverified users, and better-auth has no verification
 * email flow configured, so API signup would otherwise leave e2e users
 * permanently unverified and unable to reach any /courses page.
 */
export async function ensureEmailVerified(email: string) {
  await client.execute({
    sql: "UPDATE users SET email_verified = 1 WHERE email = ?",
    args: [email],
  });
}

/**
 * Inserts lessons directly into the e2e database, bypassing the /lessons/new
 * form (walks around form hydration and the "select a course" dropdown).
 *
 * Only columns notNull in src/db/schema.ts are filled; created_at/updated_at
 * must be given explicitly because drizzle-kit push emits them WITHOUT
 * DB-level defaults ($defaultFn/$onUpdate are app-level only). Timestamps
 * are ms (drizzle mode: timestamp / timestamp_ms) re-derived per row.
 *
 * The list page's counts come from dbGetCoursesWithItemCountsByUser's
 * correlated subqueries (src/db/courses/get-course.ts), which read the
 * lessons/assignments tables directly and need no course_items outline rows.
 */
export async function seedLessons(
  courseId: number,
  titles: string[],
): Promise<void> {
  let i = 0;
  for (const title of titles) {
    i += 1;
    await client.execute({
      sql: "INSERT INTO lessons (title, content, course_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: [title, `Content for e2e lesson ${title}`, courseId, nowPlus(i), nowPlus(i)],
    });
  }
}

/** Same as seedLessons but for assignments (example column). */
export async function seedAssignments(
  courseId: number,
  titles: string[],
): Promise<void> {
  let i = 0;
  for (const title of titles) {
    i += 1;
    await client.execute({
      sql: "INSERT INTO assignments (title, example, course_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: [title, `Example for e2e assignment ${title}`, courseId, nowPlus(i), nowPlus(i)],
    });
  }
}

/** Now in ms, nudged by i so rows never collide on created_at. */
function nowPlus(i: number): number {
  return Date.now() + i;
}
