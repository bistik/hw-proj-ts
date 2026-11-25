import { beforeAll, describe, expect, it } from "vitest";
import { getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db/";
import { submissionAnswersTable } from "@/db/schema";
import { dbGradeSubmissionAnswer } from "@/db/assignments/submissions/answers/update-answer";
import {
  createSchema,
  getAnswerRow,
  seedAnswer,
  seedAssignment,
  seedCourse,
  seedQuestion,
  seedSubmission,
  seedUser,
} from "../helpers/db";

// Issue #88, test-driven development red phase: these tests fail until
// the dead points column is gone from submission_answers. The
// contract:
// - The drizzle schema (src/db/schema.ts) declares no points column
//   on submission_answers.
// - createSchema runs the journal migrations (drizzle/*.sql), so the
//   hand-written drop migration must remove the column from the
//   migrated table (see the push note on checkOnSubmit in the schema:
//   push plans a destructive change for column drops, apply by hand
//   like drizzle/0007).
// - dbGradeSubmissionAnswer grades only through isCorrect. The
//   returned row carries no points value.
// - An insert without a points value succeeds after the migration.
//   This spec is the guard the issue asks for: it passes today
//   (the column has a default) and must stay green after the change.

describe("drop the points column from submission_answers (issue #88)", () => {
  beforeAll(createSchema);

  it("declares no points column on submission_answers in the drizzle schema", () => {
    const columns = Object.keys(getTableColumns(submissionAnswersTable));

    expect(columns).not.toContain("points");
  });

  it("drops the points column from the migrated submission_answers table", async () => {
    const rows = (await db.all(
      sql`PRAGMA table_info('submission_answers')`,
    )) as Array<{ name: string }>;

    expect(rows.map((row) => row.name)).not.toContain("points");
  });

  it("inserts a submission_answers row without a points value", async () => {
    await seedUser("author-88a");
    await seedCourse(880, "author-88a");
    await seedAssignment(8810, 880);
    const questionId = await seedQuestion(8810, "No points question", "a", 0);
    const submissionId = await seedSubmission(8810, "author-88a");

    await seedAnswer(questionId, submissionId, "answer without points");

    const row = await getAnswerRow(questionId, submissionId);
    expect(row?.answer).toBe("answer without points");
  });

  it("grades a submission answer without writing points", async () => {
    await seedUser("author-88b");
    await seedUser("student-88b");
    await seedCourse(881, "author-88b");
    await seedAssignment(8811, 881);
    const questionId = await seedQuestion(8811, "Grading question", "a", 0);
    const submissionId = await seedSubmission(8811, "student-88b");
    await seedAnswer(questionId, submissionId, "student answer");

    const updated = await dbGradeSubmissionAnswer({
      submissionId,
      questionId,
      isCorrect: true,
    });

    expect(updated?.isCorrect).toBe(true);
    expect(Object.keys(updated ?? {})).not.toContain("points");
  });
});
