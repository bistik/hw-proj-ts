import { beforeAll, describe, expect, it } from "vitest";
import { dbDeleteAssignment } from "@/db/assignments/mutate-assignment";
import {
  createSchema,
  getAnswerRow,
  getAssignmentRow,
  getCourseItemRow,
  getQuestions,
  getSubmissionRow,
  seedAnswer,
  seedAssignment,
  seedCourse,
  seedCourseItem,
  seedQuestion,
  seedSubmission,
  seedUser,
} from "../helpers/db";

// Issue #41, test-driven development red phase: these tests fail until
// dbDeleteAssignment exists. The contract:
// - Input: one course id and one assignment id (the same shape as
//   dbDeleteLesson, issue #40).
// - The delete removes the course_items outline row (itemType
//   "assignment") and the assignments row in one transaction.
//   course_items has no foreign key on item_id (lesson and assignment
//   ids share one value space), so the database cannot cascade the
//   outline row.
// - Both deletes are scoped to the course, so ids that do not match
//   the given course delete nothing.
// - The delete returns { assignmentId } when it removed a row, and
//   null when the assignment row did not match.
// - The delete does not renumber the other outline rows: gaps in the
//   position sequence stay.
// - Questions, submissions, and submission answers go with the
//   assignment through the schema's foreign keys (database cascade).

describe("dbDeleteAssignment (issue #41)", () => {
  beforeAll(createSchema);

  it("deletes the assignment row and its outline row in one call", async () => {
    await seedUser("author-1");
    await seedCourse(10, "author-1");
    await seedAssignment(101, 10);
    await seedAssignment(102, 10);
    await seedCourseItem(10, "assignment", 101, 0);
    await seedCourseItem(10, "assignment", 102, 1);

    const result = await dbDeleteAssignment({
      courseId: 10,
      assignmentId: 101,
    });

    expect(result).toEqual({ assignmentId: 101 });
    expect(await getAssignmentRow(101)).toBeNull();
    // The outline row must go with the assignment row: course_items
    // has no foreign key on item_id, so the database cannot cascade it.
    expect(await getCourseItemRow("assignment", 101)).toBeNull();
    // The untouched assignment keeps its row and its outline row.
    expect(await getAssignmentRow(102)).not.toBeNull();
    expect(await getCourseItemRow("assignment", 102)).toEqual({
      course_id: 10,
      position: 1,
    });
  });

  it("deletes nothing when the assignment belongs to another course", async () => {
    await seedCourse(11, "author-1");
    await seedAssignment(103, 11);
    await seedCourseItem(11, "assignment", 103, 0);

    const result = await dbDeleteAssignment({
      courseId: 10,
      assignmentId: 103,
    });

    // The where clauses scope both deletes to the course, so a caller
    // that mixed up course and assignment ids deletes nothing.
    expect(result).toBeNull();
    expect(await getAssignmentRow(103)).not.toBeNull();
    expect(await getCourseItemRow("assignment", 103)).toEqual({
      course_id: 11,
      position: 0,
    });
  });

  it("returns null for an unknown assignment id", async () => {
    const result = await dbDeleteAssignment({
      courseId: 10,
      assignmentId: 999,
    });

    expect(result).toBeNull();
  });

  it("keeps the positions of the remaining outline rows", async () => {
    await seedCourse(12, "author-1");
    await seedAssignment(104, 12);
    await seedAssignment(105, 12);
    await seedAssignment(106, 12);
    await seedCourseItem(12, "assignment", 104, 0);
    await seedCourseItem(12, "assignment", 105, 1);
    await seedCourseItem(12, "assignment", 106, 2);

    await dbDeleteAssignment({ courseId: 12, assignmentId: 105 });

    // A renumbering would move the last row to position 1: it must
    // stay 2 (same rule as the lesson delete, issue #40).
    expect(await getCourseItemRow("assignment", 104)).toEqual({
      course_id: 12,
      position: 0,
    });
    expect(await getCourseItemRow("assignment", 106)).toEqual({
      course_id: 12,
      position: 2,
    });
  });

  it("cascades to questions, submissions, and answers", async () => {
    await seedUser("student-1");
    await seedCourse(13, "author-1");
    await seedAssignment(107, 13);
    await seedCourseItem(13, "assignment", 107, 0);
    const questionId = await seedQuestion(107, "Question text", "Answer", 0);
    const submissionId = await seedSubmission(107, "student-1", 1000);
    await seedAnswer(questionId, submissionId, "Student answer");

    await dbDeleteAssignment({ courseId: 13, assignmentId: 107 });

    // The schema's foreign keys cascade these rows at the database
    // level: the delete fn must not remove them by hand.
    expect(await getQuestions(107)).toEqual([]);
    expect(await getSubmissionRow(submissionId)).toBeNull();
    expect(await getAnswerRow(questionId, submissionId)).toBeNull();
  });
});
