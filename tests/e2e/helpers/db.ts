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
