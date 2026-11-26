import { beforeAll, describe, expect, it } from "vitest";
import { dbSubmitAssignment } from "@/db/assignments/submissions/mutate-submission";
import {
  createSchema,
  getAnswerIsCorrect,
  getSubmissionRow,
  seedAnswer,
  seedAssignment,
  seedCourse,
  seedQuestion,
  seedSubmission,
  seedUser,
  updateAssignmentCheckOnSubmit,
} from "../helpers/db";

// Issue #95, test-driven development red phase: these tests fail until
// dbSubmitAssignment exists in src/db/assignments/submissions/
// mutate-submission.ts. The contract:
// - The fn replaces the bare "mark submitted" call in the student's
//   submit flow: it sets submitted_at on the caller's submission AND,
//   when the assignment's check_on_submit is on, grades every saved
//   answer of that submission.
// - A saved answer is correct when its text equals the question's
//   correct answer after trimming surrounding whitespace. The
//   comparison stays case-sensitive otherwise.
// - An unanswered question gets no answer row and no grade. It does
//   not count into the score, but it counts into the total (the
//   modal shows Score/Total over all questions of the assignment).
// - The return value drives the student's score modal:
//   { checked: true, score, total } for an auto-checked assignment,
//   { checked: false, score: null, total: null } for a stored-off one.
// - A stored-off assignment keeps the plain submit: submitted_at is
//   set, but no answer row receives a grade.

describe("dbSubmitAssignment (issue #95)", () => {
  beforeAll(createSchema);

  it("exports dbSubmitAssignment from the submissions mutate module", () => {
    expect(typeof dbSubmitAssignment).toBe("function");
  });

  it("marks the submission submitted and grades the answers of a stored-on assignment", async () => {
    await seedUser("author-95a");
    const studentId = "student-95a";
    await seedUser(studentId);
    await seedCourse(950, "author-95a");
    await seedAssignment(9510, 950);
    await updateAssignmentCheckOnSubmit(9510, true);

    const q1 = await seedQuestion(9510, "Capital of France", "Paris", 0);
    const q2 = await seedQuestion(9510, "Two plus two", "4", 1);
    const q3 = await seedQuestion(9510, "Colour of the sky", "blue", 2);
    const submissionId = await seedSubmission(9510, studentId);

    // "  Paris  " pins the trim rule: surrounding whitespace must not
    // fail a matching answer. "five" simply does not match "4".
    await seedAnswer(q1, submissionId, "  Paris  ");
    await seedAnswer(q2, submissionId, "five");
    // q3 stays unanswered: no submission_answers row for it.

    const result = await dbSubmitAssignment({
      assignmentId: 9510,
      assigneeId: studentId,
    });

    expect(result).toEqual({ checked: true, score: 1, total: 3 });
    expect((await getSubmissionRow(submissionId))?.submitted_at).not.toBeNull();
    expect(await getAnswerIsCorrect(q1, submissionId)).toBe(true);
    expect(await getAnswerIsCorrect(q2, submissionId)).toBe(false);
    // Unanswered: no row, so no grade and no score contribution, but
    // the question still counts into the total.
    expect(await getAnswerIsCorrect(q3, submissionId)).toBe(null);
  });

  it("grades a fully correct submission with the full score", async () => {
    await seedUser("author-95b");
    const studentId = "student-95b";
    await seedUser(studentId);
    await seedCourse(951, "author-95b");
    await seedAssignment(9520, 951);
    await updateAssignmentCheckOnSubmit(9520, true);

    const q1 = await seedQuestion(9520, "One plus one", "2", 0);
    const q2 = await seedQuestion(9520, "Three plus three", "6", 1);
    const submissionId = await seedSubmission(9520, studentId);
    await seedAnswer(q1, submissionId, "2");
    await seedAnswer(q2, submissionId, "6");

    const result = await dbSubmitAssignment({
      assignmentId: 9520,
      assigneeId: studentId,
    });

    expect(result).toEqual({ checked: true, score: 2, total: 2 });
    expect(await getAnswerIsCorrect(q1, submissionId)).toBe(true);
    expect(await getAnswerIsCorrect(q2, submissionId)).toBe(true);
  });

  it("keeps the answers ungraded for a stored-off assignment", async () => {
    await seedUser("author-95c");
    const studentId = "student-95c";
    await seedUser(studentId);
    await seedCourse(952, "author-95c");
    // seedAssignment writes no check_on_submit, so the row keeps the
    // column default: off.
    await seedAssignment(9530, 952);

    const q1 = await seedQuestion(9530, "Capital of Peru", "Lima", 0);
    const submissionId = await seedSubmission(9530, studentId);
    await seedAnswer(q1, submissionId, "Lima");

    const result = await dbSubmitAssignment({
      assignmentId: 9530,
      assigneeId: studentId,
    });

    expect(result).toEqual({ checked: false, score: null, total: null });
    // The plain submit still happens: submitted_at is set...
    expect((await getSubmissionRow(submissionId))?.submitted_at).not.toBeNull();
    // ...but the saved answer stays ungraded.
    expect(await getAnswerIsCorrect(q1, submissionId)).toBe(null);
  });
});
