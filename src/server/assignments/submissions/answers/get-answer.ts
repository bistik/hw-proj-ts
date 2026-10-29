import { dbGetSubmissionAnswer } from "@/db/assignments/submissions/answers/get-answer";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getStudentAnswer = createServerFn({ method: "GET" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Invalid assignment id"),
      questionId: z.number().int().positive("Invalid question id"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      return await dbGetSubmissionAnswer({
        assignmentId: data.assignmentId,
        questionId: data.questionId,
        assigneeId: context.user.id,
      });
    } catch (err) {
      console.error(
        `Error in fetching student answer on question ${data.questionId}`,
        err,
      );
      throw new Error("Could not fetch submission answer.");
    }
  });
