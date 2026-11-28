import { dbUpsertAnswer } from "@/db/assignments/submissions/answers/create-answer";
import { dbCreateSubmission } from "@/db/assignments/submissions/mutate-submission";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { dbGetQuestionByIdAndAssignment } from "@/db/questions/get-questions";
import { requireUserEnrolledInCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const upsertAnswer = createServerFn({ method: "POST" })
  .validator(submitAnswerFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const assignment = await dbGetAssignment(data.assignmentId);
      if (!assignment || !assignment.courseId)
        throw new Error("Could not find assignment");

      await requireUserEnrolledInCourse(assignment.courseId, context.user.id);

      const question = await dbGetQuestionByIdAndAssignment(
        data.assignmentId,
        data.questionId,
      );
      if (!question)
        throw new Error("Question does not belong to this assignment.");

      const submission = await dbCreateSubmission({
        assignmentId: data.assignmentId,
        assigneeId: context.user.id,
      });

      if (!submission) throw new Error("Could not find assignment-submission.");

      // PR #105 review: a submitted submission is read-only. The
      // question page shows the correct answer after submit (issue
      // #104), so an overwrite now would let a direct POST copy the
      // model answer into the stored answer and get credit for it.
      // The student UI cannot reach this state (the form is gone
      // after submit), but a direct POST can, like the submit guard
      // of PR #96. The check mirrors dbSetSubmissionToNow: a
      // submitted row must never change.
      if (submission.submittedAt !== null)
        throw new Error("The assignment is already submitted.");

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
