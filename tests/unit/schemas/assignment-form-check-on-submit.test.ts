import { describe, expect, it } from "vitest";
import {
  assignmentFormSchema,
  assignmentUpdateFormSchema,
  defaultValuesAssignment,
} from "@/schemas/course-schema";

// Issue #86, test-driven development red phase: these tests fail until
// the schemas hold a checkOnSubmit field. The contract:
// - The create payload (assignmentFormSchema, used by /courses/<id>/
//   assignments/new) holds checkOnSubmit: a boolean. The form renders
//   it as the 'Check answers on submit' checkbox.
// - The update payload (assignmentUpdateFormSchema, used by
//   /assignments/<id>/edit) holds the same checkOnSubmit field.
// - The field is required. The form always submits the checkbox value,
//   so a payload without the field cannot come from the real form.
// - The form default is off: defaultValuesAssignment.checkOnSubmit is
//   false, because the checkbox is unchecked by default.

const validCreatePayload = {
  title: "Check on submit assignment",
  example: "Example for the check on submit assignment",
  courseId: 3,
  points: 5,
};

const validUpdatePayload = {
  assignmentId: 9,
  title: "Check on submit assignment",
  example: "Example for the check on submit assignment",
  points: 5,
};

describe("assignmentFormSchema checkOnSubmit (issue #86)", () => {
  it("accepts and keeps both toggle values, on and off", () => {
    for (const checkOnSubmit of [true, false]) {
      const result = assignmentFormSchema.safeParse({
        ...validCreatePayload,
        checkOnSubmit,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // The schema must keep the value, not strip it as an unknown
        // key, because the create server fn persists the parsed value.
        expect(result.data.checkOnSubmit).toBe(checkOnSubmit);
      }
    }
  });

  it("rejects non-boolean values", () => {
    for (const checkOnSubmit of ["true", 1]) {
      const result = assignmentFormSchema.safeParse({
        ...validCreatePayload,
        checkOnSubmit,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing checkOnSubmit field", () => {
    const result = assignmentFormSchema.safeParse(validCreatePayload);
    expect(result.success).toBe(false);
  });
});

describe("assignmentUpdateFormSchema checkOnSubmit (issue #86)", () => {
  it("accepts and keeps both toggle values, on and off", () => {
    for (const checkOnSubmit of [true, false]) {
      const result = assignmentUpdateFormSchema.safeParse({
        ...validUpdatePayload,
        checkOnSubmit,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // The schema must keep the value, not strip it as an unknown
        // key, because the update server fn persists the parsed value.
        expect(result.data.checkOnSubmit).toBe(checkOnSubmit);
      }
    }
  });

  it("rejects non-boolean values", () => {
    for (const checkOnSubmit of ["true", 1]) {
      const result = assignmentUpdateFormSchema.safeParse({
        ...validUpdatePayload,
        checkOnSubmit,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing checkOnSubmit field", () => {
    const result = assignmentUpdateFormSchema.safeParse(validUpdatePayload);
    expect(result.success).toBe(false);
  });
});

describe("defaultValuesAssignment checkOnSubmit (issue #86)", () => {
  it("defaults the toggle to off", () => {
    // The issue: the checkbox is off/unchecked by default.
    expect(defaultValuesAssignment.checkOnSubmit).toBe(false);
  });
});
