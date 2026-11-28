import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserEnrolledInCourse } from "@/db/authz";
import * as dbMutateModule from "@/db/assignments/submissions/mutate-submission";
import * as dbAnswerModule from "@/db/assignments/submissions/answers/create-answer";
import * as serverModule from "@/server/assignments/submissions/answers/create-answer";
import { executeServerFn, loadServerFnStub } from "../helpers/server-fn";

// PR #105 review: upsertAnswer must reject a caller whose submission
// is already submitted. The contract:
// - The fn declares POST as its method and passes the answer through
//   the submitAnswerFormSchema validator.
// - The fn loads the assignment and requires the caller to be
//   enrolled in its course, like submitAssignment (PR #96 review).
// - dbCreateSubmission returns the caller's existing row when one
//   already exists, so its submitted_at says whether the answers
//   are still editable.
// - A submitted submission (submitted_at set) is read-only: the fn
//   rejects before dbUpsertAnswer runs. The student UI cannot reach
//   this state (the form is gone after submit), but a direct POST
//   can. The question page shows the correct answer after submit
//   (issue #104), so an overwrite would give the student credit for
//   the model answer.
// - An in-progress submission (submitted_at null) keeps the save.

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

vi.mock("@/db/questions/get-questions", () => ({
  dbGetQuestionByIdAndAssignment: vi.fn(async () => ({
    id: 3,
    questionText: "Capital of France",
    position: 0,
  })),
}));

vi.mock("@/db/assignments/submissions/mutate-submission", () => ({
  dbCreateSubmission: vi.fn(async () => ({
    id: 11,
    submittedAt: null,
  })),
}));

vi.mock("@/db/assignments/submissions/answers/create-answer", () => ({
  dbUpsertAnswer: vi.fn(async () => [{ id: 21 }]),
}));

const dbGetAssignmentMock = vi.mocked(dbGetAssignment);
const requireUserEnrolledInCourseMock = vi.mocked(requireUserEnrolledInCourse);
const dbCreateSubmissionMock = vi.mocked(dbMutateModule.dbCreateSubmission);
const dbUpsertAnswerMock = vi.mocked(dbAnswerModule.dbUpsertAnswer);

const payload = {
  assignmentId: 7,
  questionId: 3,
  answer: "My answer",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertAnswer (PR #105 review)", () => {
  it("declares POST as its HTTP method", () => {
    const fn = (serverModule as Record<string, unknown>).upsertAnswer as
      | { method: string }
      | undefined;
    expect(fn?.method).toBe("POST");
  });

  it("saves the answer of an in-progress submission through dbUpsertAnswer", async () => {
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/answers/create-answer.ts",
      "upsertAnswer",
    );
    const response = await executeServerFn(fn, payload);

    // The enrollment guard runs before the save (PR #96 review).
    expect(dbGetAssignmentMock).toHaveBeenCalledWith(7);
    expect(requireUserEnrolledInCourseMock).toHaveBeenCalledWith(
      10,
      "user-1",
    );
    // The assignee comes from the session, never from the payload.
    expect(dbCreateSubmissionMock).toHaveBeenCalledWith({
      assignmentId: 7,
      assigneeId: "user-1",
    });
    expect(dbUpsertAnswerMock).toHaveBeenCalledWith({
      questionId: 3,
      submissionId: 11,
      answer: "My answer",
    });
    expect(response.result).toEqual([{ id: 21 }]);
  });

  it("rejects a submitted submission before any answer write", async () => {
    // dbCreateSubmission returns the caller's existing row, and that
    // row is already submitted. The student UI cannot reach this
    // state, but a direct POST can (PR #105 review).
    dbCreateSubmissionMock.mockResolvedValueOnce({
      id: 11,
      assignmentId: 7,
      assigneeId: "user-1",
      startedAt: new Date(0),
      submittedAt: new Date(0),
      completedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const fn = await loadServerFnStub(
      "@/server/assignments/submissions/answers/create-answer.ts",
      "upsertAnswer",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;

    // The rejection keeps the handler's error shape, and the stored
    // answer never changes.
    expect(error.message).toBe("Could not submit answer.");
    expect(dbUpsertAnswerMock).not.toHaveBeenCalled();
  });
});
