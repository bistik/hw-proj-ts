import { dbUpsertAnswer } from "@/db/assignments/submissions/answers/create-answer";
import { dbCreateSubmission } from "@/db/assignments/submissions/create-submission";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const upsertAnswer = createServerFn({ method: "POST" })
  .validator(submitAnswerFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    console.log("(server) about to submit answer");
    try {
      const submission = await dbCreateSubmission({
        assignmentId: data.assignmentId,
        assigneeId: context.user.id,
      });

      if (!submission) throw new Error("Could not find assignment-submission.");
      const result = await dbUpsertAnswer({
        questionId: data.questionId,
        submissionId: submission.id,
        answer: data.answer,
      });
      return result;
    } catch (err) {
      console.error("Error in creating submission and submitting answer", err);
      throw new Error("Could not submit answer.");
    }
  });
