import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignmentByIdAndAuthor } from "@/db/assignments/get-assignment";
import { dbDeleteAssignment } from "@/db/assignments/mutate-assignment";
import { dbHasUnsubmittedWork } from "@/db/assignments/submissions/get-submission";
import * as serverModule from "@/server/assignments/mutate-assignment";
import { executeServerFn, loadServerFnStub } from "../helpers/server-fn";

// Issue #41, test-driven development red phase: these tests fail until
// the deleteAssignment server fn exists. The contract:
// - The fn declares POST as its method.
// - The payload passes a validator that carries only the assignmentId:
//   the server derives the courseId from the assignment row and never
//   trusts a client-sent course id (same shape as deleteLessonSchema,
//   issue #40).
// - The author check runs first, through dbGetAssignmentByIdAndAuthor:
//   a non-author gets "Assignment not found" without any row change.
// - The unsubmitted-work guard runs next, through
//   dbHasUnsubmittedWork: while a student of the course has not
//   submitted, the delete fails with "Cannot delete an assignment with
//   unsubmitted work." and touches no row.
// - The delete itself goes through dbDeleteAssignment with the
//   courseId of the loaded assignment row, so the course_items row and
//   the assignment row go in one transaction.
// - The fn returns the dbDeleteAssignment result.
// - A database failure becomes "Could not delete assignment" and keeps
//   the original error as its cause.

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/db/assignments/get-assignment", () => ({
  dbGetAssignment: vi.fn(),
  dbGetAssignmentByIdAndAuthor: vi.fn(async () => ({
    id: 7,
    courseId: 10,
    title: "Deletable assignment",
  })),
  dbGetAssignmentsByCourse: vi.fn(),
}));

vi.mock("@/db/assignments/submissions/get-submission", () => ({
  dbHasUnsubmittedWork: vi.fn(async () => false),
}));

vi.mock("@/db/assignments/mutate-assignment", () => ({
  dbCreateAssignment: vi.fn(),
  dbUpdateAssignment: vi.fn(),
  dbDeleteAssignment: vi.fn(async () => ({ assignmentId: 7 })),
}));

const payload = {
  assignmentId: 7,
};

const dbGetAssignmentByIdAndAuthorMock = vi.mocked(dbGetAssignmentByIdAndAuthor);
const dbHasUnsubmittedWorkMock = vi.mocked(dbHasUnsubmittedWork);
const dbDeleteAssignmentMock = vi.mocked(dbDeleteAssignment);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteAssignment (issue #41)", () => {
  it("declares POST as its HTTP method", () => {
    const fn = (serverModule as Record<string, unknown>).deleteAssignment as
      | { method: string }
      | undefined;
    expect(fn?.method).toBe("POST");
  });

  it("deletes through dbDeleteAssignment scoped to the loaded course", async () => {
    const fn = await loadServerFnStub(
      "@/server/assignments/mutate-assignment.ts",
      "deleteAssignment",
    );
    const response = await executeServerFn(fn, payload);

    expect(response.result).toEqual({ assignmentId: 7 });
    // The author check joins on the course author, so a non-author
    // never reaches the delete.
    expect(dbGetAssignmentByIdAndAuthorMock).toHaveBeenCalledWith(
      7,
      "user-1",
    );
    // The guard consults the assignment's submissions before any row
    // is removed.
    expect(dbHasUnsubmittedWorkMock).toHaveBeenCalledWith(7);
    // The courseId comes from the loaded assignment row, not from the
    // client payload.
    expect(dbDeleteAssignmentMock).toHaveBeenCalledWith({
      courseId: 10,
      assignmentId: 7,
    });
  });

  it("answers 'Assignment not found' for a non-author or unknown id", async () => {
    dbGetAssignmentByIdAndAuthorMock.mockResolvedValueOnce(undefined);
    const fn = await loadServerFnStub(
      "@/server/assignments/mutate-assignment.ts",
      "deleteAssignment",
    );
    const response = await executeServerFn(fn, payload);

    expect((response.error as Error).message).toBe("Assignment not found");
    // The guard and the delete never run for a caller without access.
    expect(dbHasUnsubmittedWorkMock).not.toHaveBeenCalled();
    expect(dbDeleteAssignmentMock).not.toHaveBeenCalled();
  });

  it("blocks the delete while a student has not submitted", async () => {
    dbHasUnsubmittedWorkMock.mockResolvedValueOnce(true);
    const fn = await loadServerFnStub(
      "@/server/assignments/mutate-assignment.ts",
      "deleteAssignment",
    );
    const response = await executeServerFn(fn, payload);

    expect((response.error as Error).message).toBe(
      "Cannot delete an assignment with unsubmitted work.",
    );
    expect(dbDeleteAssignmentMock).not.toHaveBeenCalled();
  });

  it("wraps a database failure in a clear error", async () => {
    const cause = new Error("SQLITE_BUSY");
    dbDeleteAssignmentMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/assignments/mutate-assignment.ts",
      "deleteAssignment",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;

    expect(error.message).toBe("Could not delete assignment");
    expect(error.cause).toBe(cause);
  });

  it("rejects an invalid payload before any database call", async () => {
    const fn = await loadServerFnStub(
      "@/server/assignments/mutate-assignment.ts",
      "deleteAssignment",
    );
    const response = await executeServerFn(fn, { assignmentId: -1 });

    expect(response.error).toBeDefined();
    expect(dbGetAssignmentByIdAndAuthorMock).not.toHaveBeenCalled();
    expect(dbHasUnsubmittedWorkMock).not.toHaveBeenCalled();
    expect(dbDeleteAssignmentMock).not.toHaveBeenCalled();
  });
});
