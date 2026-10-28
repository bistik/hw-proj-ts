import { dbCreateSubmission } from "@/db/assignments/submissions/create-submission";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createSubmission = createServerFn({ method: "POST" })
  .validator(submitAnswerFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await dbCreateSubmission({
      assigneeId: context.user.id,
      assignmentId: data.assignmentId,
    });
  });
