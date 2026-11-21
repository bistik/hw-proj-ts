import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import {
  dbCreateQuestion,
  dbCreateQuestions,
  dbDeleteQuestion,
  dbUpdateQuestion,
} from "@/db/questions/mutate-question";
import { getCurrentUser } from "@/lib/auth";
import * as serverModule from "@/server/questions/mutate-question";
import { executeServerFn, loadServerFnStub } from "../helpers/server-fn";

// Issue #73, test-driven development red phase: these tests fail until
// the createQuestions server fn exists. The contract:
// - The fn declares POST as its method.
// - The payload passes through the questionsBulkFormSchema validator
//   before the fn touches the database.
// - The fn loads the assignment and rejects an unknown one with
//   "Course not found".
// - The fn requires the caller to own the course of the assignment.
// - The fn calls dbCreateQuestions once, with the full payload.
// - The fn returns the value of dbCreateQuestions.
// - A database failure becomes "Could not create questions." and keeps
//   the original error as its cause.

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/db/assignments/get-assignment", () => ({
  dbGetAssignment: vi.fn(async () => ({ id: 7, courseId: 10 })),
}));

vi.mock("@/db/authz", () => ({
  requireUserOwnsCourse: vi.fn(async () => undefined),
}));

vi.mock("@/db/questions/mutate-question", () => ({
  dbCreateQuestion: vi.fn(),
  dbUpdateQuestion: vi.fn(),
  dbDeleteQuestion: vi.fn(),
  dbCreateQuestions: vi.fn(),
}));

const payload = {
  assignmentId: 7,
  questions: [
    { questionText: "What is the meaning of life?", answer: "42" },
    { questionText: "Where do we go from here?", answer: "Forward" },
  ],
};

const dbCreateQuestionsMock = vi.mocked(dbCreateQuestions);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createQuestions (issue #73)", () => {
  it("declares POST as its HTTP method", () => {
    const fn = (serverModule as Record<string, unknown>).createQuestions as
      | { method: string }
      | undefined;
    expect(fn?.method).toBe("POST");
  });

  it("creates every question through one db call", async () => {
    dbCreateQuestionsMock.mockResolvedValueOnce([
      { questionId: 11 },
      { questionId: 12 },
    ]);
    const fn = await loadServerFnStub(
      "@/server/questions/mutate-question.ts",
      "createQuestions",
    );
    const response = await executeServerFn(fn, payload);
    expect(response.result).toEqual([{ questionId: 11 }, { questionId: 12 }]);
    expect(dbCreateQuestionsMock).toHaveBeenCalledTimes(1);
    expect(dbCreateQuestionsMock).toHaveBeenCalledWith(payload);
    expect(requireUserOwnsCourse).toHaveBeenCalledWith(10, "user-1");
  });

  it("answers 'Course not found' when the assignment is missing", async () => {
    vi.mocked(dbGetAssignment).mockResolvedValueOnce(undefined);
    const fn = await loadServerFnStub(
      "@/server/questions/mutate-question.ts",
      "createQuestions",
    );
    const response = await executeServerFn(fn, payload);
    expect((response.error as Error).message).toBe("Course not found");
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("denies a caller who does not own the course", async () => {
    vi.mocked(requireUserOwnsCourse).mockRejectedValueOnce(
      new Error("User is not the author of the course"),
    );
    const fn = await loadServerFnStub(
      "@/server/questions/mutate-question.ts",
      "createQuestions",
    );
    const response = await executeServerFn(fn, payload);
    expect((response.error as Error).message).toBe(
      "User is not the author of the course",
    );
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("wraps a database failure in a clear error", async () => {
    const cause = new Error("UNIQUE constraint failed");
    dbCreateQuestionsMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/questions/mutate-question.ts",
      "createQuestions",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;
    expect(error.message).toBe("Could not create questions.");
    expect(error.cause).toBe(cause);
  });

  it("rejects an invalid payload before any database access", async () => {
    const fn = await loadServerFnStub(
      "@/server/questions/mutate-question.ts",
      "createQuestions",
    );
    const response = await executeServerFn(fn, {
      assignmentId: 7,
      questions: [],
    });
    expect(response.error).toBeDefined();
    expect(vi.mocked(dbGetAssignment)).not.toHaveBeenCalled();
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });
});
