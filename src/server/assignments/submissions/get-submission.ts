import { dbGetSubmissionByAssignmentAndStudent } from "@/db/assignments/submissions/get-submission";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getSubmission = createServerFn({ method: "GET" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Assignment id is required"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      return await dbGetSubmissionByAssignmentAndStudent(
        data.assignmentId,
        context.user.id,
      );
    } catch (err) {
      console.error(
        `Error in fetching student submission on assignment ${data.assignmentId}`,
        err,
      );
      throw new Error("Could not fetch assignment submission.");
    }
  });
