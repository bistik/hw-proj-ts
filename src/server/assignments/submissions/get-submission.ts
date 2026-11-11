import {
  dbGetSubmissionByAssignmentAndStudent,
  dbGetSubmissionForReview,
  dbGetSubmissionsByCourse,
} from "@/db/assignments/submissions/get-submission";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getSubmissionsByCourse = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      await requireUserOwnsCourse(data.courseId, context.user.id);
      return await dbGetSubmissionsByCourse(data.courseId);
    } catch (err) {
      console.error(`Error fetching submissions of course ${data.courseId}`, err);
      throw new Error("Error in fetching submissions", { cause: err });
    }
  });

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

export const getSubmissionForReview = createServerFn({ method: "GET" })
  .validator(
    z.object({
      courseId: z.number().int().positive("Course id is required"),
      assignmentId: z.number().int().positive("Assignment id is required"),
      submissionId: z.number().int().positive("Submission id is required"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);

    // Null (not an Error) when the submission does not exist, so the route
    // loader can render a 404. Ownership and mismatch problems still throw.
    const result = await dbGetSubmissionForReview(data.submissionId);
    if (!result) return null;
    const assignment = result.submission.assignment;
    if (!assignment || assignment.courseId !== data.courseId) {
      throw new Error("Submission does not belong to this course");
    }
    if (result.submission.assignmentId !== data.assignmentId) {
      throw new Error("Submission does not belong to this assignment");
    }

    const { assignee, questions } = result;
    const graded = questions.filter((q) => q.isCorrect === true).length;

    return {
      startedAt: result.submission.startedAt,
      submittedAt: result.submission.submittedAt,
      assigneeName: assignee?.name ?? "",
      assigneeEmail: assignee?.email ?? "",
      courseTitle: assignment.course?.title ?? "",
      questions,
      total: questions.length,
      correctCount: graded,
    };
  });
