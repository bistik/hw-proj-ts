import { dbCompleteSubmission } from "@/db/assignments/submissions/complete-submission";
import { requireUserOwnsSubmission } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const completeSubmissionSchema = z.object({
  courseId: z.number().int().positive("Course id is required"),
  submissionId: z.number().int().positive("Submission id is required"),
});

export const completeSubmission = createServerFn({ method: "POST" })
  .validator(completeSubmissionSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const submission = await requireUserOwnsSubmission(
      data.submissionId,
      data.courseId,
      context.user.id,
    );

    // Completing an in-progress submission makes no sense (the student can
    // still change their answers), so it stays blocked until submitted.
    if (submission.submittedAt === null) {
      throw new Error("Submission is not submitted yet");
    }

    return await dbCompleteSubmission(data.submissionId);
  });
