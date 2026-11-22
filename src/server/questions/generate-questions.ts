import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { generateQuestionsWithLlm } from "@/lib/ai/llm";
import { buildQuestionPrompt } from "@/lib/ai/prompt";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { aiQuestionsFormSchema } from "@/schemas/course-schema";
import { createQuestions } from "@/server/questions/mutate-question";
import { createServerFn } from "@tanstack/react-start";

/**
 * Generates questions for an assignment through the LLM (issue #79).
 *
 * The validator runs before any work, so an out-of-range count or an
 * over-long instruction never reaches the database or the AI service.
 * The prompt example comes from the assignment row, never from the
 * client, so a caller cannot point the model at another assignment's
 * example. The generated questions go to the createQuestions server fn
 * scoped to this assignment, and the fn returns what createQuestions
 * returns. An AI service failure becomes "Could not generate
 * questions." with the original error as its cause.
 */
export const generateQuestions = createServerFn({ method: "POST" })
  .validator(aiQuestionsFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment?.courseId) {
      throw new Error("Course not found");
    }
    await requireUserOwnsCourse(assignment.courseId, context.user.id);

    const messages = buildQuestionPrompt({
      example: assignment.example ?? "",
      filter: data.filter,
      count: data.count,
    });

    let questions;
    try {
      questions = await generateQuestionsWithLlm(messages);
    } catch (err) {
      console.error("Error in generating questions with the LLM", err);
      throw new Error("Could not generate questions.", { cause: err });
    }

    return createQuestions({
      data: { assignmentId: assignment.id, questions },
    });
  });
