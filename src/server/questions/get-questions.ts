import {
  dbGetQuestionByIdAndAuthor,
  dbGetQuestionsByAssignment,
} from "@/db/questions/get-questions";
import { getCurrentUser } from "@/lib/auth";
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
  .handler(async ({ data: questionId }) => {
    const user = await getCurrentUser();
    try {
      return await dbGetQuestionByIdAndAuthor(questionId, user.id);
    } catch (err) {
      console.error(`Error in fetching question ${questionId}`, err);
      throw new Error("Could not retrieve question", { cause: err });
    }
  });
