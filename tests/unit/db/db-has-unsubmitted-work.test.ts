import { beforeAll, describe, expect, it } from "vitest";
import { dbHasUnsubmittedWork } from "@/db/assignments/submissions/get-submission";
import {
  createSchema,
  seedAssignment,
  seedCourse,
  seedEnrollment,
  seedSubmission,
  seedUser,
} from "../helpers/db";

// Issue #41, test-driven development red phase: these tests fail until
// dbHasUnsubmittedWork exists. The contract:
// - Input: one assignment id. The helper derives the course by itself.
// - A student "has not submitted" (issue #41) when their submission row
//   for the assignment has no submitted_at value, or when the student
//   has no submission row at all.
// - The students are the enrollment rows of the assignment's course
//   with status "active" or "completed" — the same definition of
//   "student of the course" as the rest of the app. Enrollments with
//   status "invited", "declined", or "dropped" never count.
// - The helper returns true when at least one student has not
//   submitted, and false otherwise.
// - Students of other courses and submissions of other assignments
//   never change the answer.

describe("dbHasUnsubmittedWork (issue #41)", () => {
  beforeAll(createSchema);

  it("returns false when the course has no students", async () => {
    await seedUser("author-20");
    await seedCourse(20, "author-20");
    await seedAssignment(201, 20);

    expect(await dbHasUnsubmittedWork(201)).toBe(false);
  });

  it("returns true when a student has an in-progress submission", async () => {
    await seedUser("u-inprogress");
    await seedCourse(21, "author-20");
    await seedAssignment(202, 21);
    await seedEnrollment("u-inprogress", 21);
    // No submitted_at value: the student started but did not submit.
    await seedSubmission(202, "u-inprogress", null);

    expect(await dbHasUnsubmittedWork(202)).toBe(true);
  });

  it("returns true when an enrolled student has no submission row", async () => {
    await seedUser("u-no-row");
    await seedCourse(22, "author-20");
    await seedAssignment(203, 22);
    await seedEnrollment("u-no-row", 22);
    // u-no-row has no submission row at all.

    expect(await dbHasUnsubmittedWork(203)).toBe(true);
  });

  it("returns false when every student has submitted", async () => {
    await seedUser("u-submitted-1");
    await seedUser("u-submitted-2");
    await seedCourse(23, "author-20");
    await seedAssignment(204, 23);
    await seedEnrollment("u-submitted-1", 23);
    await seedEnrollment("u-submitted-2", 23);
    await seedSubmission(204, "u-submitted-1", 1000);
    await seedSubmission(204, "u-submitted-2", 2000);

    expect(await dbHasUnsubmittedWork(204)).toBe(false);
  });

  it("ignores the submissions of another assignment", async () => {
    await seedUser("u-mixed");
    await seedCourse(24, "author-20");
    await seedAssignment(205, 24);
    await seedAssignment(206, 24);
    await seedEnrollment("u-mixed", 24);
    await seedSubmission(205, "u-mixed", 3000); // submitted
    await seedSubmission(206, "u-mixed", null); // in progress

    expect(await dbHasUnsubmittedWork(205)).toBe(false);
    expect(await dbHasUnsubmittedWork(206)).toBe(true);
  });

  it("ignores the students of another course", async () => {
    await seedUser("u-other-course");
    await seedCourse(25, "author-20");
    await seedCourse(26, "author-20");
    await seedAssignment(207, 25);
    await seedAssignment(208, 26);
    // Enrolled in course 26 only, and with no submission row.
    await seedEnrollment("u-other-course", 26);

    expect(await dbHasUnsubmittedWork(207)).toBe(false);
    expect(await dbHasUnsubmittedWork(208)).toBe(true);
  });

  it("ignores an invited student who has no submission row", async () => {
    await seedUser("u-invited");
    await seedCourse(27, "author-20");
    await seedAssignment(209, 27);
    // The invite flow creates enrollment rows with status "invited".
    // The student never accepted, so they cannot open the course and
    // can never submit. They must not block the delete.
    await seedEnrollment("u-invited", 27, "invited");

    expect(await dbHasUnsubmittedWork(209)).toBe(false);
  });

  it("ignores a dropped student who has no submission row", async () => {
    await seedUser("u-dropped");
    await seedCourse(28, "author-20");
    await seedAssignment(210, 28);
    // The student left the course, so they cannot submit anymore.
    await seedEnrollment("u-dropped", 28, "dropped");

    expect(await dbHasUnsubmittedWork(210)).toBe(false);
  });

  it("counts a completed student who has not submitted", async () => {
    await seedUser("u-completed");
    await seedCourse(29, "author-20");
    await seedAssignment(211, 29);
    // "completed" is the second accepted status, so this student
    // still counts as a student of the course.
    await seedEnrollment("u-completed", 29, "completed");

    expect(await dbHasUnsubmittedWork(211)).toBe(true);
  });

  it("blocks the delete when an active student is pending next to a dropped one", async () => {
    await seedUser("u-pending-active");
    await seedCourse(30, "author-20");
    await seedAssignment(212, 30);
    await seedEnrollment("u-pending-active", 30);
    await seedEnrollment("u-dropped", 30, "dropped");

    expect(await dbHasUnsubmittedWork(212)).toBe(true);
  });
});
