import { dbGetQuestionByIdAndAuthor } from "@/db/questions/get-questions";
import { dbUpdateQuestion } from "@/db/questions/update-question";
import { getCurrentUser } from "@/lib/auth";
import { questionUpdateFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const updateQuestion = createServerFn({ method: "POST" })
  .validator(questionUpdateFormSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    const question = await dbGetQuestionByIdAndAuthor(data.questionId, user.id);
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
