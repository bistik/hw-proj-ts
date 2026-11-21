import { sql } from "drizzle-orm";
import { db } from "@/db/";

/**
 * Creates the tables that question tests need. The statements copy
 * drizzle/0000_purple_giant_girl.sql, so the in-memory database keeps
 * the production constraints: questions.assignment_id references the
 * assignments table, and (assignment_id, position) is unique.
 * Keep this file in sync with the migrations.
 */
export async function createQuestionsTables(): Promise<void> {
  // The courses table stays empty: the assignments row uses a NULL
  // course_id, so no courses row is needed. The table must exist because
  // libSQL checks the referenced table on every insert.
  await db.run(sql`CREATE TABLE \`courses\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`title\` text NOT NULL,
    \`description\` text,
    \`author_id\` text NOT NULL,
    \`created_at\` integer NOT NULL,
    \`updated_at\` integer NOT NULL,
    FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`);
  await db.run(sql`CREATE TABLE \`assignments\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`title\` text NOT NULL,
    \`course_id\` integer,
    \`created_at\` integer NOT NULL,
    \`updated_at\` integer NOT NULL,
    FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`);
  await db.run(sql`CREATE TABLE \`questions\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`question_text\` text NOT NULL,
    \`assignment_id\` integer,
    \`answer\` text NOT NULL,
    \`position\` integer NOT NULL,
    \`created_at\` integer NOT NULL,
    \`updated_at\` integer NOT NULL,
    FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`);
  await db.run(
    sql`CREATE UNIQUE INDEX \`questions_assignment_position_unique\` ON \`questions\` (\`assignment_id\`,\`position\`)`,
  );
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
  const rows = await db.all(sql`SELECT
    \`id\`,
    \`question_text\` AS questionText,
    \`answer\`,
    \`position\`
  FROM \`questions\` WHERE \`assignment_id\` = ${assignmentId} ORDER BY \`position\``);

  return rows.map((row) => ({
    id: row.id as number,
    questionText: row.questionText as string,
    answer: row.answer as string,
    position: row.position as number,
  }));
}
