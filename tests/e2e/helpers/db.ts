import { createClient } from "@libsql/client";

// The same local libsql file the E2E webServer points at
// (see playwright.config.ts). Lets tests touch seeded rows directly, e.g.
// for flags the app expects but no signup API path sets.
const client = createClient({
  url: "file:./tests/e2e/e2e-test.db",
  // Wait for a held file lock instead of failing fast with SQLITE_BUSY:
  // the dev-server process and this process both write to the same e2e DB
  // file, so a write here can legitimately collide with the app's writes.
  timeout: 10_000,
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
 * Inserts a course directly into the e2e database, bypassing the
 * /courses/new form, and returns its id. The author is located by email (the
 * seeded users' ids are unstable across runs — see seedEnrollment).
 *
 * Only columns notNull in src/db/schema.ts are filled; created_at/updated_at
 * must be given explicitly because drizzle-kit push emits them WITHOUT
 * DB-level defaults ($defaultFn/$onUpdate are app-level only).
 */
export async function seedCourse(
  authorEmail: string,
  course: { title: string; description: string },
): Promise<number> {
  const author = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [authorEmail],
  });
  const authorId = author.rows[0]?.id;
  if (!authorId) {
    throw new Error(`[e2e] no user found for email ${authorEmail}`);
  }
  const now = Date.now();
  const inserted = await client.execute({
    sql: "INSERT INTO courses (title, description, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
    args: [course.title, course.description, authorId, now, now],
  });
  return Number(inserted.rows[0]!.id);
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
      args: [
        title,
        `Content for e2e lesson ${title}`,
        courseId,
        nowPlus(i),
        nowPlus(i),
      ],
    });
  }
}

/**
 * Inserts an enrollment row directly into the e2e database.
 *
 * `status` defaults to "active" to match the existing callers, but tests can
 * pass any status (e.g. "dropped", "invited") to seed a roster whose badges
 * show mixed enrollment states.
 *
 * The user is located by email (the seeded users' ids are unstable across
 * runs, since they are created through the better-auth sign-up API in
 * global-setup.ts). Only columns notNull in src/db/schema.ts are filled;
 * enrolled_at/created_at/updated_at must be given explicitly because
 * drizzle-kit push emits them WITHOUT DB-level defaults ($defaultFn is
 * app-level only).
 */
export async function seedEnrollment(
  email: string,
  courseId: number,
  status: string = "active",
): Promise<void> {
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO enrollments (user_id, course_id, status, enrolled_at, created_at, updated_at)
          SELECT users.id, ?, ?, ?, ?, ? FROM users WHERE users.email = ?`,
    args: [courseId, status, now, now, now, email],
  });
}

/** Same as seedLessons but for assignments (example column). */
export async function seedAssignments(
  courseId: number,
  titles: string[],
): Promise<number[]> {
  let i = 0;
  const ids: number[] = [];
  for (const title of titles) {
    i += 1;
    const inserted = await client.execute({
      sql: "INSERT INTO assignments (title, example, course_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
      args: [
        title,
        `Example for e2e assignment ${title}`,
        courseId,
        nowPlus(i),
        nowPlus(i),
      ],
    });
    ids.push(Number(inserted.rows[0]!.id));
  }
  return ids;
}

/**
 * Seeds questions for an assignment directly in the e2e database, with
 * consecutive positions 0..n-1 (the student page orders questions by
 * position and derives the displayed Q# from it).
 *
 * Returns the inserted question ids in insertion (position) order. The
 * question page lives at /student/assignments/<assignment_id>/questions/
 * <question_id>, so tests need the ids, not just the texts. Existing
 * callers ignore the return value, so this stays backward compatible.
 *
 * Only columns notNull in src/db/schema.ts are filled; created_at/updated_at
 * are given explicitly like for the other seeders (their drizzle-kit push
 * emits no DB-level defaults).
 */
export async function seedQuestions(
  assignmentId: number,
  questionTexts: string[],
): Promise<number[]> {
  let i = 0;
  const ids: number[] = [];
  for (const questionText of questionTexts) {
    i += 1;
    const inserted = await client.execute({
      sql: "INSERT INTO questions (question_text, answer, assignment_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
      args: [
        questionText,
        `Answer for e2e question ${i}`,
        assignmentId,
        i - 1,
        nowPlus(i),
        nowPlus(i),
      ],
    });
    ids.push(Number(inserted.rows[0]!.id));
  }
  return ids;
}

/**
 * Seeds an assignment submission for the user identified by email.
 *
 * The user is located by email like the row-level seeders above. Only
 * columns notNull in src/db/schema.ts are filled; started_at/created_at/
 * updated_at must be given explicitly (drizzle-kit push emits no DB-level
 * defaults and $defaultFn is app-level only).
 *
 * submittedAt defaults to null — an in-progress submission, which is what
 * makes the student assignment page render its "Submit assignment" button.
 * Pass a ms timestamp to seed an already-submitted record instead.
 */
export async function seedSubmission(
  assignmentId: number,
  email: string,
  submittedAt: number | null = null,
): Promise<void> {
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO assignment_submissions (assignment_id, assignee_id, started_at, submitted_at, created_at, updated_at)
          SELECT ?, users.id, ?, ?, ?, ? FROM users WHERE users.email = ?`,
    args: [assignmentId, now, submittedAt, now, now, email],
  });
}

/**
 * Seeds a saved answer (a submission_answers row) for the user identified by
 * email, attached to the user's assignment_submissions row for the given
 * assignment. Mirrors how the app stores answers: one row per (question_id,
 * submission_id) pair, enforced by the submission_answers_question_submission_unique
 * index.
 *
 * Rounds/regrades read this row to display the student's answer with the
 * question, and the question page's form uses it as the default value.
 *
 * Only columns notNull in src/db/schema.ts are filled; created_at/updated_at
 * are given explicitly like the other seeders (drizzle-kit push emits no
 * DB-level defaults).
 */
export async function seedSubmissionAnswer(
  assignmentId: number,
  email: string,
  questionId: number,
  answer: string,
): Promise<void> {
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO submission_answers (answer, question_id, submission_id, created_at, updated_at)
          SELECT ?, ?, assignment_submissions.id, ?, ?
          FROM assignment_submissions
          JOIN users ON users.id = assignment_submissions.assignee_id
          WHERE assignment_submissions.assignment_id = ? AND users.email = ?`,
    args: [answer, questionId, now, now, assignmentId, email],
  });
}

/** Now in ms, nudged by i so rows never collide on created_at. */
function nowPlus(i: number): number {
  return Date.now() + i;
}
