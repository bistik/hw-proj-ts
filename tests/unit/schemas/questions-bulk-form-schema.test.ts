import { describe, expect, it } from "vitest";
import { questionsBulkFormSchema } from "@/schemas/course-schema";

// Issue #73, test-driven development red phase: these tests fail until
// the schema exists. The contract:
// - The payload holds an assignment id and a list of question items.
// - Each item holds a non-empty questionText and a non-empty answer.
// - The list must hold at least one item.
// - The list must hold at most 100 items, so one POST cannot carry
//   thousands of items.
// - The assignment id must be a positive integer, like
//   questionFormSchema.

const validPayload = {
  assignmentId: 7,
  questions: [
    { questionText: "What is the meaning of life?", answer: "42" },
    { questionText: "Where do we go from here?", answer: "Forward" },
  ],
};

describe("questionsBulkFormSchema (issue #73)", () => {
  it("accepts an assignment id with one or more question items", () => {
    const result = questionsBulkFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("keeps the questions in the submitted order", () => {
    const result = questionsBulkFormSchema.parse(validPayload);
    expect(result.questions.map((item) => item.questionText)).toEqual([
      "What is the meaning of life?",
      "Where do we go from here?",
    ]);
  });

  it("accepts a single question item", () => {
    const result = questionsBulkFormSchema.safeParse({
      assignmentId: 7,
      questions: [{ questionText: "Only one?", answer: "Yes" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty questions array", () => {
    const result = questionsBulkFormSchema.safeParse({
      assignmentId: 7,
      questions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing questions array", () => {
    const result = questionsBulkFormSchema.safeParse({ assignmentId: 7 });
    expect(result.success).toBe(false);
  });

  it("rejects an item with empty question text", () => {
    const result = questionsBulkFormSchema.safeParse({
      assignmentId: 7,
      questions: [{ questionText: "", answer: "42" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an item with an empty answer", () => {
    const result = questionsBulkFormSchema.safeParse({
      assignmentId: 7,
      questions: [{ questionText: "Question?", answer: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an item with a missing answer", () => {
    const result = questionsBulkFormSchema.safeParse({
      assignmentId: 7,
      questions: [{ questionText: "Question?" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a questions array that holds more than 100 items", () => {
    const result = questionsBulkFormSchema.safeParse({
      assignmentId: 7,
      questions: Array.from({ length: 101 }, (_, index) => ({
        questionText: `Question ${index + 1}`,
        answer: `Answer ${index + 1}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero, negative, or fractional assignment id", () => {
    for (const assignmentId of [0, -1, 1.5]) {
      const result = questionsBulkFormSchema.safeParse({
        assignmentId,
        questions: validPayload.questions,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing assignment id", () => {
    const result = questionsBulkFormSchema.safeParse({
      questions: validPayload.questions,
    });
    expect(result.success).toBe(false);
  });
});
