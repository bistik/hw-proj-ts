import {
  dbGetSubmissionByAssignmentAndStudent,
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
