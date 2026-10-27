import {
  dbGetQuestionByIdAndAuthor,
  dbGetQuestionsByAssignment,
} from "@/db/questions/get-questions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export const getQuestions = createServerFn({
  method: "GET",
})
  .validator((assignmentId: number) => assignmentId)
  .handler(async ({ data: assignmentId }) => {
    try {
      const result = await dbGetQuestionsByAssignment(assignmentId);
      return result;
    } catch (err) {
      console.error(
        `Error in fetching questions for assignment ${assignmentId}`,
        err,
      );
      throw new Error("Could not fetch questions", { cause: err });
    }
  });

export const getQuestion = createServerFn({ method: "GET" })
  .validator((questionId: number) => questionId)
  .middleware([authMiddleware])
  .handler(async ({ data: questionId, context }) => {
    try {
      return await dbGetQuestionByIdAndAuthor(questionId, context.user.id);
    } catch (err) {
      console.error(`Error in fetching question ${questionId}`, err);
      throw new Error("Could not retrieve question", { cause: err });
    }
  });
