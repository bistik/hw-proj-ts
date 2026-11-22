import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { buildQuestionPrompt } from "@/lib/ai/prompt";
import { generateQuestionsWithLlm } from "@/lib/ai/llm";
import * as serverModule from "@/server/questions/generate-questions";
import { createQuestions } from "@/server/questions/mutate-question";
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
// - The fn builds the prompt from the example stored on the assignment
//   row (not from client input), the additional instruction, and the
//   count.
// - The fn calls the AI service once with the built messages.
// - The fn passes the AI questions to the createQuestions server fn,
//   together with the loaded assignment's id, so the questions stay
//   scoped to this assignment.
// - The fn returns the value of createQuestions.
// - An AI service failure becomes "Could not generate questions." and
//   keeps the original error as its cause.

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

vi.mock("@/server/questions/mutate-question", () => ({
  createQuestion: vi.fn(),
  createQuestions: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
}));

const assignment = {
  id: 7,
  courseId: 10,
  example: "Example:\nQ: What is 1 + 1\nA: 2",
};

const payload = {
  assignmentId: 7,
  count: 10,
  additionalInstruction: "Limit answers to whole numbers under 100.",
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
const createQuestionsMock = vi.mocked(createQuestions);

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

  it("sends the generated questions to createQuestions scoped to the assignment", async () => {
    createQuestionsMock.mockResolvedValueOnce([
      { questionId: 11 },
      { questionId: 12 },
    ]);
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, payload);

    expect(response.result).toEqual([{ questionId: 11 }, { questionId: 12 }]);
    expect(dbGetAssignmentMock).toHaveBeenCalledWith(7);
    expect(requireUserOwnsCourseMock).toHaveBeenCalledWith(10, "user-1");
    // The prompt example comes from the assignment row, so a client
    // cannot point the model at another assignment's example.
    expect(buildQuestionPromptMock).toHaveBeenCalledWith({
      example: assignment.example,
      additionalInstruction: payload.additionalInstruction,
      count: payload.count,
    });
    expect(generateQuestionsWithLlmMock).toHaveBeenCalledTimes(1);
    expect(generateQuestionsWithLlmMock).toHaveBeenCalledWith(promptMessages);
    expect(createQuestionsMock).toHaveBeenCalledTimes(1);
    expect(createQuestionsMock).toHaveBeenCalledWith({
      data: { assignmentId: 7, questions: llmQuestions },
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
    expect(createQuestionsMock).not.toHaveBeenCalled();
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
    expect(createQuestionsMock).not.toHaveBeenCalled();
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
    expect(createQuestionsMock).not.toHaveBeenCalled();
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
    expect(createQuestionsMock).not.toHaveBeenCalled();
  });

  it("rejects an additional instruction that is too long before any work", async () => {
    const fn = await loadServerFnStub(
      "@/server/questions/generate-questions.ts",
      "generateQuestions",
    );
    const response = await executeServerFn(fn, {
      ...payload,
      additionalInstruction: "a".repeat(301),
    });
    expect(response.error).toBeDefined();
    expect(dbGetAssignmentMock).not.toHaveBeenCalled();
    expect(buildQuestionPromptMock).not.toHaveBeenCalled();
    expect(generateQuestionsWithLlmMock).not.toHaveBeenCalled();
    expect(createQuestionsMock).not.toHaveBeenCalled();
  });
});
