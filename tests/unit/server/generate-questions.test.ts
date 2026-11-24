import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateQuestions } from "@/db/questions/mutate-question";
import { buildQuestionPrompt } from "@/lib/ai/prompt";
import { generateQuestionsWithLlm } from "@/lib/ai/llm";
import * as serverModule from "@/server/questions/generate-questions";
import { executeServerFn, loadServerFnStub } from "../helpers/server-fn";

// Issue #79, test-driven development red phase: these tests fail until
// the generateQuestions server fn and its AI helpers exist. The
// contract:
// - The fn declares POST as its method.
// - The payload passes through the aiQuestionsFormSchema validator
//   before the fn touches the database or the AI service.
// - The fn loads the assignment and rejects an unknown one with
//   "Course not found".
// - The fn requires the caller to own the course of the assignment.
// - The fn rejects an assignment with no example before it calls the
//   AI service (PR #80 review).
// - The fn builds the prompt from the example stored on the assignment
//   row (not from client input), the filter, and the count.
// - The fn calls the AI service once with the built messages and the
//   requested count, so a generate cannot return more than asked for.
// - The fn writes the AI questions through dbCreateQuestions, scoped
//   to the loaded assignment — a server fn does not re-enter another
//   server fn, so the guards run once (PR #80 follow-up).
// - The fn returns the inserted rows, one per question.
// - An AI service or insert failure becomes "Could not generate
//   questions." and keeps the original error as its cause.

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/db/assignments/get-assignment", () => ({
  dbGetAssignment: vi.fn(async () => ({
    id: 7,
    courseId: 10,
    example: "Example:\nQ: What is 1 + 1\nA: 2",
  })),
}));

vi.mock("@/db/authz", () => ({
  requireUserOwnsCourse: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ai/prompt", () => ({
  buildQuestionPrompt: vi.fn(() => [
    { role: "system", content: "system prompt" },
    { role: "user", content: "user prompt" },
  ]),
}));

vi.mock("@/lib/ai/llm", () => ({
  generateQuestionsWithLlm: vi.fn(async () => [
    { questionText: "What is 2 + 2?", answer: "4" },
    { questionText: "What is 3 + 3?", answer: "6" },
  ]),
}));

vi.mock("@/db/questions/mutate-question", () => ({
  dbCreateQuestions: vi.fn(async () => [
    { questionId: 11 },
    { questionId: 12 },
  ]),
}));

const assignment = {
  id: 7,
  courseId: 10,
  example: "Example:\nQ: What is 1 + 1\nA: 2",
};

const payload = {
  assignmentId: 7,
  count: 10,
  filter: "Limit answers to whole numbers under 100.",
};

const promptMessages = [
  { role: "system", content: "system prompt" },
  { role: "user", content: "user prompt" },
];

const llmQuestions = [
  { questionText: "What is 2 + 2?", answer: "4" },
  { questionText: "What is 3 + 3?", answer: "6" },
];

const dbGetAssignmentMock = vi.mocked(dbGetAssignment);
const requireUserOwnsCourseMock = vi.mocked(requireUserOwnsCourse);
const buildQuestionPromptMock = vi.mocked(buildQuestionPrompt);
const generateQuestionsWithLlmMock = vi.mocked(generateQuestionsWithLlm);
const dbCreateQuestionsMock = vi.mocked(dbCreateQuestions);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateQuestions (issue #79)", () => {
  it("declares POST as its HTTP method", () => {
    const fn = (serverModule as Record<string, unknown>).generateQuestions as
      | { method: string }
      | undefined;
    expect(fn?.method).toBe("POST");
  });

  it("writes the generated questions through dbCreateQuestions scoped to the assignment", async () => {
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);

    // The fn returns the inserted rows, so the caller can report the
    // count of generated questions and answers.
    expect(response.result).toEqual([{ questionId: 11 }, { questionId: 12 }]);
    expect(dbGetAssignmentMock).toHaveBeenCalledWith(7);
    expect(requireUserOwnsCourseMock).toHaveBeenCalledWith(10, "user-1");
    // The prompt example comes from the assignment row, so a client
    // cannot point the model at another assignment's example.
    expect(buildQuestionPromptMock).toHaveBeenCalledWith({
      example: assignment.example,
      filter: payload.filter,
      count: payload.count,
    });
    expect(generateQuestionsWithLlmMock).toHaveBeenCalledTimes(1);
    expect(generateQuestionsWithLlmMock).toHaveBeenCalledWith(
      promptMessages,
      // PR #80 review: the count travels to the LLM fn, so the parsed
      // list is capped at what the author asked for.
      { session: "hw-proj-ts-assignment-7", count: payload.count },
    );
    // PR #80 follow-up: the insert goes straight to the db helper, not
    // through another server fn, so the guards above run only once.
    expect(dbGetAssignmentMock).toHaveBeenCalledTimes(1);
    expect(requireUserOwnsCourseMock).toHaveBeenCalledTimes(1);
    expect(dbCreateQuestionsMock).toHaveBeenCalledTimes(1);
    expect(dbCreateQuestionsMock).toHaveBeenCalledWith({
      assignmentId: 7,
      questions: llmQuestions,
    });
  });

  it("answers 'Course not found' when the assignment is missing", async () => {
    dbGetAssignmentMock.mockResolvedValueOnce(undefined);
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);
    expect((response.error as Error).message).toBe("Course not found");
    expect(generateQuestionsWithLlmMock).not.toHaveBeenCalled();
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("denies a caller who does not own the course", async () => {
    requireUserOwnsCourseMock.mockRejectedValueOnce(
      new Error("User is not the author of the course"),
    );
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);
    expect((response.error as Error).message).toBe(
      "User is not the author of the course",
    );
    expect(generateQuestionsWithLlmMock).not.toHaveBeenCalled();
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("rejects an assignment with no example before it calls the LLM", async () => {
    // PR #80 review: the model has nothing to learn from without an
    // example, so the generate request fails with a clear message.
    dbGetAssignmentMock.mockResolvedValueOnce({
      id: 7,
      courseId: 10,
      title: "No-example assignment",
      example: null,
      points: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);
    expect((response.error as Error).message).toBe(
      "This assignment has no example yet. Add an example first.",
    );
    expect(generateQuestionsWithLlmMock).not.toHaveBeenCalled();
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("wraps an AI service failure in a clear error", async () => {
    const cause = new Error("Connection reset");
    generateQuestionsWithLlmMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;
    expect(error.message).toBe("Could not generate questions.");
    expect(error.cause).toBe(cause);
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("wraps an insert failure in the same clear error", async () => {
    // PR #80 follow-up: the fn owns the insert, so a database failure
    // also becomes the generate error, not a create error.
    const cause = new Error("SQLITE_BUSY");
    dbCreateQuestionsMock.mockRejectedValueOnce(cause);
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);
    const error = response.error as Error;
    expect(error.message).toBe("Could not generate questions.");
    expect(error.cause).toBe(cause);
  });

  it("rejects a count above the dropdown maximum before any work", async () => {
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, {
      ...payload,
      count: 21,
    });
    expect(response.error).toBeDefined();
    expect(dbGetAssignmentMock).not.toHaveBeenCalled();
    expect(buildQuestionPromptMock).not.toHaveBeenCalled();
    expect(generateQuestionsWithLlmMock).not.toHaveBeenCalled();
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });

  it("rejects a filter that is too long before any work", async () => {
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, {
      ...payload,
      filter: "a".repeat(301),
    });
    expect(response.error).toBeDefined();
    expect(dbGetAssignmentMock).not.toHaveBeenCalled();
    expect(buildQuestionPromptMock).not.toHaveBeenCalled();
    expect(generateQuestionsWithLlmMock).not.toHaveBeenCalled();
    expect(dbCreateQuestionsMock).not.toHaveBeenCalled();
  });
});
