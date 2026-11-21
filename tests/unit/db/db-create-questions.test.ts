import { beforeAll, describe, expect, it } from "vitest";
import { dbCreateQuestions } from "@/db/questions/mutate-question";
import {
  createQuestionsTables,
  getQuestions,
  seedAssignment,
  seedQuestion,
} from "../helpers/db";

// Issue #73, test-driven development red phase: these tests fail until
// dbCreateQuestions exists. The contract:
// - Input: one assignment id and a list of question items.
// - The function inserts every item in one call.
// - Positions start after the highest existing position of that
//   assignment, then increase by one, in input order.
// - The position of one assignment never depends on rows of another
//   assignment.
// - The insert is atomic: a failure inserts nothing.
// - Output: one questionId per item, in input order.

describe("dbCreateQuestions (issue #73)", () => {
  beforeAll(createQuestionsTables);

  it("inserts every item with sequential positions starting at 0", async () => {
    await seedAssignment(101);
    await dbCreateQuestions({
      assignmentId: 101,
      questions: [
        { questionText: "First", answer: "1" },
        { questionText: "Second", answer: "2" },
        { questionText: "Third", answer: "3" },
      ],
    });
    const rows = await getQuestions(101);
    expect(
      rows.map((row) => [row.questionText, row.answer, row.position]),
    ).toEqual([
      ["First", "1", 0],
      ["Second", "2", 1],
      ["Third", "3", 2],
    ]);
  });

  it("returns one questionId per item, in input order", async () => {
    await seedAssignment(102);
    const created = await dbCreateQuestions({
      assignmentId: 102,
      questions: [
        { questionText: "Alpha", answer: "a" },
        { questionText: "Beta", answer: "b" },
      ],
    });
    expect(created).toHaveLength(2);
    const rows = await getQuestions(102);
    expect(rows.map((row) => row.questionText)).toEqual(["Alpha", "Beta"]);
    expect(created.map((item) => item.questionId)).toEqual(
      rows.map((row) => row.id),
    );
  });

  it("continues positions after the highest existing one", async () => {
    await seedAssignment(103);
    await seedQuestion(103, "Existing one", "old", 0);
    await seedQuestion(103, "Existing two", "old", 1);
    await dbCreateQuestions({
      assignmentId: 103,
      questions: [
        { questionText: "New one", answer: "new" },
        { questionText: "New two", answer: "new" },
      ],
    });
    const rows = await getQuestions(103);
    expect(rows.map((row) => [row.questionText, row.position])).toEqual([
      ["Existing one", 0],
      ["Existing two", 1],
      ["New one", 2],
      ["New two", 3],
    ]);
  });

  it("does not count rows of another assignment", async () => {
    await seedAssignment(104);
    await seedQuestion(104, "Other", "old", 5);
    await seedAssignment(105);
    await dbCreateQuestions({
      assignmentId: 105,
      questions: [{ questionText: "Fresh", answer: "new" }],
    });
    expect((await getQuestions(105)).map((row) => row.position)).toEqual([0]);
  });

  it("inserts nothing when any item fails", async () => {
    await seedAssignment(106);
    await expect(
      dbCreateQuestions({
        assignmentId: 106,
        questions: [
          { questionText: "Valid", answer: "1" },
          { questionText: null as unknown as string, answer: "2" },
        ],
      }),
    ).rejects.toThrow();
    expect(await getQuestions(106)).toEqual([]);
  });
});
