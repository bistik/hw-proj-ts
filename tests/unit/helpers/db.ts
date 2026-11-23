import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/";

/**
 * Creates every table by running the real migration files
 * (drizzle/*.sql) in the order of drizzle/meta/_journal.json — the
 * same order as `npm run db:migrate`. The in-memory database therefore
 * keeps the production schema, including the foreign keys that cascade
 * an assignment delete to its questions, submissions, and answers
 * (issue #41). Migration 0003 removed the early enrollments status
 * check, so a seeded enrollment may carry any status, for example
 * "invited". A migration edit cannot make the test schema drift from
 * the production schema.
 */
export async function createSchema(): Promise<void> {
  const journal = JSON.parse(
    readFileSync(
      new URL("../../../drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    ),
  ) as { entries: Array<{ tag: string }> };

  for (const { tag } of journal.entries) {
    const migration = readFileSync(
      new URL(`../../../drizzle/${tag}.sql`, import.meta.url),
      "utf8",
    );
    // drizzle separates the migration statements with this marker. The
    // database client runs one statement per call, so this loop runs
    // each statement alone.
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim().length === 0) {
        continue;
      }
      await db.run(sql.raw(statement));
    }
  }
}

/**
 * Creates the schema that question tests need. Delegates to
 * createSchema: the questions tables come from the same base migration
 * as every other table.
 */
export async function createQuestionsTables(): Promise<void> {
  await createSchema();
}

/**
 * Adds one users row, so the courses and enrollments foreign keys stay
 * valid. Only columns notNull in src/db/auth-schema.ts are filled.
 */
export async function seedUser(userId: string): Promise<void> {
  await db.run(sql`INSERT INTO \`users\` (
    \`id\`, \`name\`, \`email\`, \`email_verified\`, \`created_at\`, \`updated_at\`
  ) VALUES (${userId}, 'Test user', ${`${userId}@example.com`}, 1, 0, 0)`);
}

/**
 * Adds one courses row owned by the given author. The author row must
 * exist (seedUser) because courses.author_id references users.
 */
export async function seedCourse(
  courseId: number,
  authorId: string,
): Promise<void> {
  await db.run(sql`INSERT INTO \`courses\` (
    \`id\`, \`title\`, \`description\`, \`author_id\`, \`created_at\`, \`updated_at\`
  ) VALUES (${courseId}, 'Test course', 'Course for db tests', ${authorId}, 0, 0)`);
}

/**
 * Adds one course_items outline row. The seeder does not check that the
 * referenced lesson/assignment row exists: course_items.item_id has no
 * foreign key (lesson and assignment ids share one value space).
 */
export async function seedCourseItem(
  courseId: number,
  itemType: "lesson" | "assignment",
  itemId: number,
  position: number,
): Promise<void> {
  await db.run(sql`INSERT INTO \`course_items\` (
    \`course_id\`, \`item_type\`, \`item_id\`, \`position\`, \`created_at\`, \`updated_at\`
  ) VALUES (${courseId}, ${itemType}, ${itemId}, ${position}, 0, 0)`);
}

/**
 * Adds one enrollments row. `status` defaults to "active", the state of
 * a student who belongs to the course.
 */
export async function seedEnrollment(
  userId: string,
  courseId: number,
  status: string = "active",
): Promise<void> {
  await db.run(sql`INSERT INTO \`enrollments\` (
    \`user_id\`, \`course_id\`, \`status\`, \`enrolled_at\`, \`created_at\`, \`updated_at\`
  ) VALUES (${userId}, ${courseId}, ${status}, 0, 0, 0)`);
}

/**
 * Adds one assignments row. The optional courseId attaches the
 * assignment to a course for tests that need the course scope (issue
 * #41: delete an assignment). Only columns notNull in src/db/schema.ts
 * are filled.
 */
export async function seedAssignment(
  assignmentId: number,
  courseId: number | null = null,
): Promise<void> {
  await db.run(sql`INSERT INTO \`assignments\` (
    \`id\`, \`title\`, \`course_id\`, \`created_at\`, \`updated_at\`
  ) VALUES (${assignmentId}, 'Test assignment', ${courseId}, 0, 0)`);
}

/**
 * Adds one questions row at a fixed position and returns the row's id.
 * Existing callers ignore the return value, so this stays backward
 * compatible.
 */
export async function seedQuestion(
  assignmentId: number,
  questionText: string,
  answer: string,
  position: number,
): Promise<number> {
  const rows = (await db.all(sql`INSERT INTO \`questions\` (
    \`question_text\`, \`assignment_id\`, \`answer\`, \`position\`, \`created_at\`, \`updated_at\`
  ) VALUES (${questionText}, ${assignmentId}, ${answer}, ${position}, 0, 0)
  RETURNING \`id\``)) as Array<{ id: number }>;
  return rows[0]!.id;
}

/**
 * Adds one assignment_submissions row for the given user and returns
 * its id. submittedAt defaults to null: an in-progress submission, the
 * state the unsubmitted-work guard of issue #41 must catch. Pass a
 * value to seed a submitted record instead.
 */
export async function seedSubmission(
  assignmentId: number,
  userId: string,
  submittedAt: number | null = null,
): Promise<number> {
  const rows = (await db.all(sql`INSERT INTO \`assignment_submissions\` (
    \`assignment_id\`, \`assignee_id\`, \`started_at\`, \`submitted_at\`, \`created_at\`, \`updated_at\`
  ) VALUES (${assignmentId}, ${userId}, 0, ${submittedAt}, 0, 0)
  RETURNING \`id\``)) as Array<{ id: number }>;
  return rows[0]!.id;
}

/** Adds one submission_answers row for a (question, submission) pair. */
export async function seedAnswer(
  questionId: number,
  submissionId: number,
  answer: string,
): Promise<void> {
  await db.run(sql`INSERT INTO \`submission_answers\` (
    \`answer\`, \`question_id\`, \`submission_id\`, \`created_at\`, \`updated_at\`
  ) VALUES (${answer}, ${questionId}, ${submissionId}, 0, 0)`);
}

export type QuestionRow = {
  id: number;
  questionText: string;
  answer: string;
  position: number;
};

/** Returns the questions of one assignment, ordered by position. */
export async function getQuestions(
  assignmentId: number,
): Promise<QuestionRow[]> {
  const rows = (await db.all(sql`SELECT
    \`id\`,
    \`question_text\` AS questionText,
    \`answer\`,
    \`position\`
  FROM \`questions\` WHERE \`assignment_id\` = ${assignmentId} ORDER BY \`position\``)) as QuestionRow[];

  return rows.map((row) => ({
    id: row.id as number,
    questionText: row.questionText as string,
    answer: row.answer as string,
    position: row.position as number,
  }));
}

/**
 * Reads the assignments row with the given id. Returns null when the
 * row is missing — which is the behaviour under test in issue #41
 * (delete an assignment), so this read helper must not throw.
 */
export async function getAssignmentRow(
  assignmentId: number,
): Promise<{ course_id: number; title: string } | null> {
  const rows = (await db.all(sql`SELECT
    \`course_id\`,
    \`title\`
  FROM \`assignments\` WHERE \`id\` = ${assignmentId}`)) as Array<{
    course_id: number | null;
    title: string;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    course_id: Number(row.course_id),
    title: String(row.title),
  };
}

/**
 * Reads the course_items outline row that points at the given item.
 * Returns null when the row is missing — which is the behaviour under
 * test in issue #41 (delete an assignment), so this read helper must
 * not throw.
 */
export async function getCourseItemRow(
  itemType: "lesson" | "assignment",
  itemId: number,
): Promise<{ course_id: number; position: number } | null> {
  const rows = (await db.all(sql`SELECT
    \`course_id\`,
    \`position\`
  FROM \`course_items\` WHERE \`item_type\` = ${itemType} AND \`item_id\` = ${itemId}`)) as Array<{
    course_id: number;
    position: number;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    course_id: Number(row.course_id),
    position: Number(row.position),
  };
}

/**
 * Reads the assignment_submissions row with the given id. Returns null
 * when the row is missing — which is the cascade behaviour under test
 * in issue #41 (delete an assignment), so this read helper must not
 * throw.
 */
export async function getSubmissionRow(
  submissionId: number,
): Promise<{ assignment_id: number; submitted_at: number | null } | null> {
  const rows = (await db.all(sql`SELECT
    \`assignment_id\`,
    \`submitted_at\`
  FROM \`assignment_submissions\` WHERE \`id\` = ${submissionId}`)) as Array<{
    assignment_id: number;
    submitted_at: number | null;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    assignment_id: Number(row.assignment_id),
    submitted_at: row.submitted_at === null ? null : Number(row.submitted_at),
  };
}

/**
 * Reads the submission_answers row for the given (questionId,
 * submissionId) pair. Returns null when the row is missing — which is
 * the cascade behaviour under test in issue #41 (delete an
 * assignment), so this read helper must not throw.
 */
export async function getAnswerRow(
  questionId: number,
  submissionId: number,
): Promise<{ answer: string } | null> {
  const rows = (await db.all(sql`SELECT
    \`answer\`
  FROM \`submission_answers\` WHERE \`question_id\` = ${questionId} AND \`submission_id\` = ${submissionId}`)) as Array<{
    answer: string;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }
  return { answer: String(row.answer) };
}
