import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignmentByIdAndAuthor } from "@/db/assignments/get-assignment";
import { dbGetQuestionsByAssignment } from "@/db/questions/get-questions";
import * as serverModule from "@/server/questions/get-questions";
import { executeServerFn, loadServerFnStub } from "../helpers/server-fn";

// Issue #19, test-driven development red phase: these tests fail until
// the getQuestions server fn checks authorization. Today the handler
// returns full question rows for any assignment id, including the
// answer column, so any authenticated user can leak the answers by
// calling the fn directly. The contract after the fix:
// - The fn declares GET as its HTTP method.
// - The author check runs first, through dbGetAssignmentByIdAndAuthor:
//   the lookup joins on the course author, exactly like
//   getAssignmentById (issue #18 review). A caller who is not the
//   course author gets null, and the questions query never runs, so
//   no answer column can leak.
// - An author receives the questions of the assignment through
//   dbGetQuestionsByAssignment.
// - A database failure becomes "Could not fetch questions" and keeps
//   the original error as its cause.

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/db/assignments/get-assignment", () => ({
  dbGetAssignment: vi.fn(),
  dbGetAssignmentByIdAndAuthor: vi.fn(async () => ({
    id: 7,
    courseId: 10,
    title: "Author-owned assignment",
  })),
  dbGetAssignmentsByCourse: vi.fn(),
}));

vi.mock("@/db/questions/get-questions", () => ({
  dbGetQuestionsByAssignment: vi.fn(async () => questions),
  dbGetQuestionByIdAndAuthor: vi.fn(),
  dbGetQuestionsForStudent: vi.fn(),
  dbGetQuestionByIdAndAssignment: vi.fn(),
  dbGetNextQuestionByPosition: vi.fn(),
  dbGetPreviousQuestionByPosition: vi.fn(),
}));

// The answer column is the secret: these rows must reach an author
// only.
const questions = [
  {
    id: 11,
    assignmentId: 7,
    position: 0,
    questionText: "What is 2 + 2?",
    answer: "4",
  },
  {
    id: 12,
    assignmentId: 7,
    position: 1,
    questionText: "What is 3 + 3?",
    answer: "6",
  },
];

const dbGetAssignmentByIdAndAuthorMock = vi.mocked(
  dbGetAssignmentByIdAndAuthor,
);
const dbGetQuestionsByAssignmentMock = vi.mocked(
  dbGetQuestionsByAssignment,
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getQuestions (issue #19)", () => {
  it("declares GET as its HTTP method", () => {
    const fn = (serverModule as Record<string, unknown>).getQuestions as
      | { method: string }
      | undefined;
    expect(fn?.method).toBe("GET");
  });

  it("fetches questions only after the author check passes", async () => {
    const fn = await loadServerFnStub(
      "@/server/questions/get-questions.ts",
      "getQuestions",
    );
    const response = await executeServerFn(fn, 7);

    expect(response.result).toEqual(questions);
    // The author check joins on the course author, so the questions
    // read only runs for the owner of the course.
    expect(dbGetAssignmentByIdAndAuthorMock).toHaveBeenCalledWith(
      7,
      "user-1",
    );
    expect(dbGetQuestionsByAssignmentMock).toHaveBeenCalledWith(7);
  });

  it("returns null and no questions for a non-author or unknown id", async () => {
    dbGetAssignmentByIdAndAuthorMock.mockResolvedValueOnce(undefined);
    const fn = await loadServerFnStub(
      "@/server/questions/get-questions.ts",
      "getQuestions",
    );
    const response = await executeServerFn(fn, 7);

    // Null mirrors getAssignmentById: the route loader turns null into
    // notFound(), and a direct caller learns nothing about the
    // assignment or its answers.
    expect(response.result).toBeNull();
    // The questions query never runs for a caller without access, so
    // the answer column cannot leak.
    expect(dbGetQuestionsByAssignmentMock).not.toHaveBeenCalled();
  });

  it("wraps a database failure in a clear error", async () => {
    const cause = new Error("SQLITE_BUSY");
    dbGetQuestionsByAssignmentMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/questions/get-questions.ts",
      "getQuestions",
    );
    const response = await executeServerFn(fn, 7);
    const error = response.error as Error;

    expect(error.message).toBe("Could not fetch questions");
    expect(error.cause).toBe(cause);
  });
});
