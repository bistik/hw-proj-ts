import { dbGetQuestionsByAssignment } from "@/db/questions/get-questions";
import { createServerFn } from "@tanstack/react-start";

export const getQuestions = createServerFn({
  method: "GET",
})
  .validator((assignmentId: number) => assignmentId)
  .handler(async ({ data: assignmentId }) => {
    const result = await dbGetQuestionsByAssignment(assignmentId);
    return result;
  });
