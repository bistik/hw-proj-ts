import { dbDeleteQuestion } from "@/db/questions/delete-question";
import { dbGetQuestionByIdAndAuthor } from "@/db/questions/get-questions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { deleteQuestionSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * Deletes one question of an assignment (issue #54). The author check
 * runs first (dbGetQuestionByIdAndAuthor joins on the course author), so
 * a non-author gets "Question not found" without touching any row. The
 * validator carries only the questionId: the server derives the course
 * from the question's assignment and never trusts a client-sent course
 * id (same shape as deleteLesson).
 */
export const deleteQuestion = createServerFn({ method: "POST" })
  .validator(deleteQuestionSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const question = await dbGetQuestionByIdAndAuthor(
      data.questionId,
      context.user.id,
    );
    if (!question) throw new Error("Question not found");
    try {
      return await dbDeleteQuestion(data.questionId);
    } catch (err) {
      console.error(`Error in deleting question ${data.questionId}`, err);
      throw new Error("Could not delete question", { cause: err });
    }
  });
