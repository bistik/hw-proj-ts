import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/";

/**
 * Creates the schema that question tests need. The statements come
 * from the real migration file drizzle/0000_purple_giant_girl.sql,
 * so the in-memory database always keeps the production constraints:
 * questions.assignment_id references the assignments table, and
 * (assignment_id, position) is unique. A migration edit cannot make
 * the test schema drift from the production schema.
 */
export async function createQuestionsTables(): Promise<void> {
  const migration = readFileSync(
    new URL("../../../drizzle/0000_purple_giant_girl.sql", import.meta.url),
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

/** Adds one assignments row so the questions foreign key stays valid. */
export async function seedAssignment(assignmentId: number): Promise<void> {
  await db.run(sql`INSERT INTO \`assignments\` (
    \`id\`, \`title\`, \`course_id\`, \`created_at\`, \`updated_at\`
  ) VALUES (${assignmentId}, 'Test assignment', NULL, 0, 0)`);
}

/** Adds one questions row at a fixed position. */
export async function seedQuestion(
  assignmentId: number,
  questionText: string,
  answer: string,
  position: number,
): Promise<void> {
  await db.run(sql`INSERT INTO \`questions\` (
    \`question_text\`, \`assignment_id\`, \`answer\`, \`position\`, \`created_at\`, \`updated_at\`
  ) VALUES (${questionText}, ${assignmentId}, ${answer}, ${position}, 0, 0)`);
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
