import {
  dbCreateSubmission,
  dbSetSubmissionToNow,
  dbSubmitAssignment,
} from "@/db/assignments/submissions/mutate-submission";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserEnrolledInCourse } from "@/db/authz";
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

export const submitAssignment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Assignment id is required"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      // Defense in depth (PR #96 review): the submit writes only rows
      // behind an enrollment-protected submission, but this guard
      // rejects a non-enrolled caller up front, the same way
      // upsertAnswer does.
      const assignment = await dbGetAssignment(data.assignmentId);
      if (!assignment || !assignment.courseId)
        throw new Error("Could not find assignment");

      await requireUserEnrolledInCourse(assignment.courseId, context.user.id);

      return await dbSubmitAssignment({
        assignmentId: data.assignmentId,
        assigneeId: context.user.id,
      });
    } catch (err) {
      console.error(
        `Error in submitting assignment ${data.assignmentId} for user ${context.user.id}`,
        err,
      );
      throw new Error("Could not submit assignment.", { cause: err });
    }
  });
