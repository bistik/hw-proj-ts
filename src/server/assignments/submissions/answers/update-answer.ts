import { dbGradeSubmissionAnswer } from "@/db/assignments/submissions/answers/update-answer";
import { requireUserOwnsSubmission } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const gradeSubmissionAnswerSchema = z.object({
  courseId: z.number().int().positive("Course id is required"),
  submissionId: z.number().int().positive("Submission id is required"),
  questionId: z.number().int().positive("Question id is required"),
  isCorrect: z.boolean(),
});

export const gradeSubmissionAnswer = createServerFn({ method: "POST" })
  .validator(gradeSubmissionAnswerSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    // The submission must exist, belong to this course, and the caller
    // must own the course — all checked by the one authz guard.
    const submission = await requireUserOwnsSubmission(
      data.submissionId,
      data.courseId,
      context.user.id,
    );

    // Completing closes the review: after completed_at is set, marks stay
    // frozen. This mirrors the submittedAt check in completeSubmission, so
    // a stale tab or a direct POST cannot change marks either.
    if (submission.completedAt !== null) {
      throw new Error("Submission is already completed");
    }

    const updated = await dbGradeSubmissionAnswer({
      submissionId: data.submissionId,
      questionId: data.questionId,
      isCorrect: data.isCorrect,
    });
    if (!updated) throw new Error("Answer not found");

    return updated;
  });
