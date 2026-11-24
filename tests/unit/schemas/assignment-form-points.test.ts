import { describe, expect, it } from "vitest";
import {
  assignmentFormSchema,
  assignmentUpdateFormSchema,
} from "@/schemas/course-schema";

// Issue #84, test-driven development red phase: these tests fail until
// the schemas hold a points field. The contract:
// - The create payload (assignmentFormSchema, used by /courses/<id>/
//   assignments/new) holds points: a whole number from 1 to 10. The
//   form's "points" dropdown offers exactly 1..10, so a payload can
//   never ask for points outside the dropdown.
// - The update payload (assignmentUpdateFormSchema, used by
//   /assignments/<id>/edit) holds the same points field with the same
//   bounds.
// - The points are required: a payload without points cannot save an
//   assignment that the detail page could then display.

const validCreatePayload = {
  title: "Points assignment",
  example: "Example for the points assignment",
  courseId: 3,
  // Issue #86 added a required checkOnSubmit field to both payloads,
  // so a valid payload must carry it too.
  checkOnSubmit: false,
};

const validUpdatePayload = {
  assignmentId: 9,
  title: "Points assignment",
  example: "Example for the points assignment",
  checkOnSubmit: false,
};

describe("assignmentFormSchema points (issue #84)", () => {
  it("accepts and keeps the smallest and the largest points of the dropdown", () => {
    for (const points of [1, 10]) {
      const result = assignmentFormSchema.safeParse({
        ...validCreatePayload,
        points,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // The schema must keep the points, not strip them as an unknown
        // key, because the create server fn persists the parsed value.
        expect(result.data.points).toBe(points);
      }
    }
  });

  it("rejects points above the dropdown maximum of 10", () => {
    const result = assignmentFormSchema.safeParse({
      ...validCreatePayload,
      points: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero, negative, or fractional points", () => {
    for (const points of [0, -1, 1.5]) {
      const result = assignmentFormSchema.safeParse({
        ...validCreatePayload,
        points,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing points field", () => {
    const result = assignmentFormSchema.safeParse(validCreatePayload);
    expect(result.success).toBe(false);
  });
});

describe("assignmentUpdateFormSchema points (issue #84)", () => {
  it("accepts and keeps the smallest and the largest points of the dropdown", () => {
    for (const points of [1, 10]) {
      const result = assignmentUpdateFormSchema.safeParse({
        ...validUpdatePayload,
        points,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // The schema must keep the points, not strip them as an unknown
        // key, because the update server fn persists the parsed value.
        expect(result.data.points).toBe(points);
      }
    }
  });

  it("rejects points above the dropdown maximum of 10", () => {
    const result = assignmentUpdateFormSchema.safeParse({
      ...validUpdatePayload,
      points: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero, negative, or fractional points", () => {
    for (const points of [0, -1, 1.5]) {
      const result = assignmentUpdateFormSchema.safeParse({
        ...validUpdatePayload,
        points,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing points field", () => {
    const result = assignmentUpdateFormSchema.safeParse(validUpdatePayload);
    expect(result.success).toBe(false);
  });
});
