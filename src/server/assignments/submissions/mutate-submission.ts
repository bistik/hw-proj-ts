import {
  dbCreateSubmission,
  dbSetSubmissionToNow,
} from "@/db/assignments/submissions/mutate-submission";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const createSubmission = createServerFn({ method: "POST" })
  .validator(submitAnswerFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await dbCreateSubmission({
      assigneeId: context.user.id,
      assignmentId: data.assignmentId,
    });
  });

export const setSubmissionToNow = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Assignment id is required"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      await dbSetSubmissionToNow({
        assignmentId: data.assignmentId,
        assigneeId: context.user.id,
      });
    } catch (err) {
      console.error(
        `Error in marking assignment-submission as submitted for assignment ${data.assignmentId} and user ${context.user.id}`,
        err,
      );
      throw new Error("Could not submit assignment.");
    }
  });
