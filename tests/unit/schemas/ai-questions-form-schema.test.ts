import { describe, expect, it } from "vitest";
import { aiQuestionsFormSchema } from "@/schemas/course-schema";

// Issue #79, test-driven development red phase: these tests fail until
// the schema exists. The contract:
// - The payload holds the assignment id, the number of questions to
//   generate (count), and the additional instruction text.
// - The count is a whole number between 1 and 20. The AI tab's
//   "Number of questions" dropdown offers 1..20 (issue #70), so a
//   payload can never ask for more questions than the dropdown allows.
// - The additional instruction is a string of at most 300 characters:
//   enough room for one clear instruction, no room for a long
//   prompt-injection text.
// - The assignment id is a positive integer, like questionFormSchema.
// - The example is not part of the payload: the server fn reads it
//   from the assignment row, so a client cannot swap in its own.

const validPayload = {
  assignmentId: 7,
  count: 10,
  additionalInstruction: "Limit answers to whole numbers under 100.",
};

describe("aiQuestionsFormSchema (issue #79)", () => {
  it("accepts an assignment id, a count, and an instruction", () => {
    const result = aiQuestionsFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts the smallest and the largest count of the dropdown", () => {
    for (const count of [1, 20]) {
      const result = aiQuestionsFormSchema.safeParse({ ...validPayload, count });
      expect(result.success).toBe(true);
    }
  });

  it("accepts an empty additional instruction", () => {
    const result = aiQuestionsFormSchema.safeParse({
      ...validPayload,
      additionalInstruction: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a count above the dropdown maximum of 20", () => {
    const result = aiQuestionsFormSchema.safeParse({ ...validPayload, count: 21 });
    expect(result.success).toBe(false);
  });

  it("rejects a zero, negative, or fractional count", () => {
    for (const count of [0, -1, 1.5]) {
      const result = aiQuestionsFormSchema.safeParse({ ...validPayload, count });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing count", () => {
    const result = aiQuestionsFormSchema.safeParse({
      assignmentId: 7,
      additionalInstruction: "Limit answers to whole numbers.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an additional instruction longer than 300 characters", () => {
    const result = aiQuestionsFormSchema.safeParse({
      ...validPayload,
      additionalInstruction: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an additional instruction of exactly 300 characters", () => {
    const result = aiQuestionsFormSchema.safeParse({
      ...validPayload,
      additionalInstruction: "a".repeat(300),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero, negative, or fractional assignment id", () => {
    for (const assignmentId of [0, -1, 1.5]) {
      const result = aiQuestionsFormSchema.safeParse({ ...validPayload, assignmentId });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing assignment id", () => {
    const result = aiQuestionsFormSchema.safeParse({
      count: 10,
      additionalInstruction: "Limit answers to whole numbers.",
    });
    expect(result.success).toBe(false);
  });
});
