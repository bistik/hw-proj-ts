import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserEnrolledInCourse } from "@/db/authz";
import * as dbMutateModule from "@/db/assignments/submissions/mutate-submission";
import * as serverModule from "@/server/assignments/submissions/mutate-submission";
import { executeServerFn, loadServerFnStub } from "../helpers/server-fn";

// Issue #95, test-driven development red phase: these tests fail until
// the submitAssignment server fn exists in src/server/assignments/
// submissions/mutate-submission.ts. The contract:
// - The fn declares POST as its method.
// - The payload passes a validator that carries only the assignmentId:
//   the server derives the assignee from the session user, never from
//   the payload (same shape as setSubmissionToNow).
// - The fn loads the assignment and requires the caller to be
//   enrolled in its course before any submit (PR #96 review: the same
//   guard as upsertAnswer, as defense in depth).
// - The fn calls dbSubmitAssignment with { assignmentId, assigneeId }
//   and returns its result: the { checked, score, total } payload that
//   drives the student's score modal.
// - A database failure becomes "Could not submit assignment." and
//   keeps the original error as its cause.

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/db/assignments/get-assignment", () => ({
  dbGetAssignment: vi.fn(async () => ({
    id: 7,
    courseId: 10,
  })),
}));

vi.mock("@/db/authz", () => ({
  requireUserEnrolledInCourse: vi.fn(async () => undefined),
}));

vi.mock("@/db/assignments/submissions/mutate-submission", () => ({
  dbCreateSubmission: vi.fn(),
  dbSetSubmissionToNow: vi.fn(),
  dbSubmitAssignment: vi.fn(async () => ({
    checked: true,
    score: 2,
    total: 3,
  })),
}));

const dbGetAssignmentMock = vi.mocked(dbGetAssignment);
const requireUserEnrolledInCourseMock = vi.mocked(requireUserEnrolledInCourse);
const dbSubmitAssignmentMock = vi.mocked(dbMutateModule.dbSubmitAssignment);

const payload = {
  assignmentId: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitAssignment (issue #95)", () => {
  it("declares POST as its HTTP method", () => {
    const fn = (serverModule as Record<string, unknown>).submitAssignment as
      | { method: string }
      | undefined;
    expect(fn?.method).toBe("POST");
  });

  it("submits through dbSubmitAssignment scoped to the caller and returns the score payload", async () => {
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/mutate-submission.ts",
      "submitAssignment",
    );
    const response = await executeServerFn(fn, payload);

    expect(response.result).toEqual({ checked: true, score: 2, total: 3 });
    // The enrollment guard runs before the submit (PR #96 review).
    expect(dbGetAssignmentMock).toHaveBeenCalledWith(7);
    expect(requireUserEnrolledInCourseMock).toHaveBeenCalledWith(
      10,
      "user-1",
    );
    // The assignee comes from the session, not from the payload.
    expect(dbSubmitAssignmentMock).toHaveBeenCalledWith({
      assignmentId: 7,
      assigneeId: "user-1",
    });
  });

  it("rejects an unknown assignment before any submit call", async () => {
    dbGetAssignmentMock.mockResolvedValueOnce(undefined);
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/mutate-submission.ts",
      "submitAssignment",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;

    expect(error.message).toBe("Could not submit assignment.");
    expect(requireUserEnrolledInCourseMock).not.toHaveBeenCalled();
    expect(dbSubmitAssignmentMock).not.toHaveBeenCalled();
  });

  it("rejects a caller who is not enrolled in the course of the assignment", async () => {
    const cause = new Error("User is not enrolled to the course");
    requireUserEnrolledInCourseMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/mutate-submission.ts",
      "submitAssignment",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;

    expect(error.message).toBe("Could not submit assignment.");
    expect(error.cause).toBe(cause);
    expect(dbSubmitAssignmentMock).not.toHaveBeenCalled();
  });

  it("wraps a database failure in a clear error", async () => {
    const cause = new Error("SQLITE_BUSY");
    dbSubmitAssignmentMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/mutate-submission.ts",
      "submitAssignment",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;

    expect(error.message).toBe("Could not submit assignment.");
    expect(error.cause).toBe(cause);
  });

  it("rejects an invalid payload before any database call", async () => {
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/mutate-submission.ts",
      "submitAssignment",
    );
    const response = await executeServerFn(fn, { assignmentId: -1 });

    expect(response.error).toBeDefined();
    expect(dbGetAssignmentMock).not.toHaveBeenCalled();
    expect(dbSubmitAssignmentMock).not.toHaveBeenCalled();
  });
});
