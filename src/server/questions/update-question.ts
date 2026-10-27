import { dbGetQuestionByIdAndAuthor } from "@/db/questions/get-questions";
import { dbUpdateQuestion } from "@/db/questions/update-question";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { questionUpdateFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const updateQuestion = createServerFn({ method: "POST" })
  .validator(questionUpdateFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const question = await dbGetQuestionByIdAndAuthor(
      data.questionId,
      context.user.id,
    );
    if (!question) throw new Error("Question not found");
    try {
      return await dbUpdateQuestion(
        { questionText: data.questionText, answer: data.answer },
        data.questionId,
      );
    } catch (err) {
      console.error(`Error in updating question ${data.questionId}`, err);
      throw new Error("Could not update question", { cause: err });
    }
  });
