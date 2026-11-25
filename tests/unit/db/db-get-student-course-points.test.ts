import { beforeAll, describe, expect, it } from "vitest";
import { dbGetStudentCoursePoints } from "@/db/courses/get-course";
import {
  createSchema,
  deleteQuestionRow,
  seedAnswer,
  seedAssignment,
  seedCourse,
  seedQuestion,
  seedSubmission,
  seedUser,
  updateAssignmentPoints,
} from "../helpers/db";

// Issue #89, test-driven development red phase: these tests fail until
// dbGetStudentCoursePoints exists. The contract:
// - Input: one course id and one student id.
// - Output: { earned, possible }.
// - earned = SUM(assignments.points) over the student's answers with
//   is_correct = true in the course. The sum is computed at read time
//   from the current assignments.points; no per-answer points are
//   stored (issue #88 removed that column).
// - possible = SUM(assignment.points x question count) over all
//   assignments in the course.
// - An ungraded answer (is_correct is null) adds nothing to earned but
//   still counts in possible.

describe("dbGetStudentCoursePoints (issue #89)", () => {
  beforeAll(createSchema);

  it("returns earned 0 and the full possible when the student has no submission", async () => {
    await seedUser("author-89a");
    await seedCourse(890, "author-89a");
    await seedAssignment(8901, 890, 3);
    await seedQuestion(8901, "First question", "a", 0);
    await seedQuestion(8901, "Second question", "b", 1);
    await seedAssignment(8902, 890, 5);
    await seedQuestion(8902, "Third question", "c", 0);

    // possible = 3 x 2 questions + 5 x 1 question. No answer rows
    // exist, so earned stays 0.
    await expect(
      dbGetStudentCoursePoints(890, "student-89a"),
    ).resolves.toEqual({ earned: 0, possible: 11 });
  });

  it("sums the current assignment.points over the student's correct answers", async () => {
    await seedUser("author-89b");
    await seedUser("student-89b");
    await seedCourse(891, "author-89b");
    await seedAssignment(8911, 891, 4);
    const correctOne = await seedQuestion(8911, "Correct one", "a", 0);
    const correctTwo = await seedQuestion(8911, "Correct two", "b", 1);
    await seedAssignment(8912, 891, 2);
    await seedQuestion(8912, "Unanswered question", "c", 0);
    const submissionId = await seedSubmission(8911, "student-89b");
    await seedAnswer(correctOne, submissionId, "student answer", true);
    await seedAnswer(correctTwo, submissionId, "student answer", true);

    // earned = 4 points x 2 correct answers. possible adds the
    // unanswered assignment: 4 x 2 + 2 x 1.
    await expect(
      dbGetStudentCoursePoints(891, "student-89b"),
    ).resolves.toEqual({ earned: 8, possible: 10 });
  });

  it("keeps ungraded and wrong answers out of earned but counted in possible", async () => {
    await seedUser("author-89c");
    await seedUser("student-89c");
    await seedCourse(892, "author-89c");
    await seedAssignment(8921, 892, 3);
    const graded = await seedQuestion(8921, "Graded question", "a", 0);
    const wrong = await seedQuestion(8921, "Wrong question", "b", 1);
    const ungraded = await seedQuestion(8921, "Ungraded question", "c", 2);
    const submissionId = await seedSubmission(8921, "student-89c");
    await seedAnswer(graded, submissionId, "student answer", true);
    await seedAnswer(wrong, submissionId, "student answer", false);
    await seedAnswer(ungraded, submissionId, "student answer", null);

    // Only the correct answer earns (3). The wrong and ungraded
    // answers earn nothing, but their questions still count in
    // possible (3 x 3).
    await expect(
      dbGetStudentCoursePoints(892, "student-89c"),
    ).resolves.toEqual({ earned: 3, possible: 9 });
  });

  it("recomputes earned and possible after the author edits assignment.points", async () => {
    await seedUser("author-89d");
    await seedUser("student-89d");
    await seedCourse(893, "author-89d");
    await seedAssignment(8931, 893, 2);
    const questionId = await seedQuestion(8931, "Edit question", "a", 0);
    const submissionId = await seedSubmission(8931, "student-89d");
    await seedAnswer(questionId, submissionId, "student answer", true);

    await expect(
      dbGetStudentCoursePoints(893, "student-89d"),
    ).resolves.toEqual({ earned: 2, possible: 2 });

    // The author raises the points from 2 to 7. Nothing is stored per
    // answer, so the next read reports both totals with 7.
    await updateAssignmentPoints(8931, 7);
    await expect(
      dbGetStudentCoursePoints(893, "student-89d"),
    ).resolves.toEqual({ earned: 7, possible: 7 });
  });

  it("stays correct after a deleted question cascades its answer rows away", async () => {
    await seedUser("author-89e");
    await seedUser("student-89e");
    await seedCourse(894, "author-89e");
    await seedAssignment(8941, 894, 3);
    const kept = await seedQuestion(8941, "Kept question", "a", 0);
    const deleted = await seedQuestion(8941, "Deleted question", "b", 1);
    const submissionId = await seedSubmission(8941, "student-89e");
    await seedAnswer(kept, submissionId, "student answer", true);
    await seedAnswer(deleted, submissionId, "student answer", true);

    await expect(
      dbGetStudentCoursePoints(894, "student-89e"),
    ).resolves.toEqual({ earned: 6, possible: 6 });

    // The schema's foreign key cascades the deleted question's answer
    // rows, so both totals drop to the kept question only.
    await deleteQuestionRow(deleted);
    await expect(
      dbGetStudentCoursePoints(894, "student-89e"),
    ).resolves.toEqual({ earned: 3, possible: 3 });
  });

  it("keeps another student's answers and another course's assignments out of the totals", async () => {
    await seedUser("author-89f");
    await seedUser("student-89f");
    await seedUser("student-89g");
    await seedCourse(895, "author-89f");
    await seedAssignment(8951, 895, 2);
    const questionId = await seedQuestion(8951, "Scoped question", "a", 0);
    await seedCourse(896, "author-89f");
    await seedAssignment(8961, 896, 9);
    await seedQuestion(8961, "Other course question", "b", 0);

    const submissionId = await seedSubmission(8951, "student-89f");
    await seedAnswer(questionId, submissionId, "student answer", true);

    // The correct answer belongs to student-89f, so it never counts
    // for student-89g. Assignment 8961 belongs to course 896, so its
    // 9 points stay out of course 895's possible.
    await expect(
      dbGetStudentCoursePoints(895, "student-89f"),
    ).resolves.toEqual({ earned: 2, possible: 2 });
    await expect(
      dbGetStudentCoursePoints(895, "student-89g"),
    ).resolves.toEqual({ earned: 0, possible: 2 });
  });
});
