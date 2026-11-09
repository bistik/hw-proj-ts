import { dbUpdateEnrollmentStatus } from "@/db/enrollments/update-enrollment";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const acceptInvitation = createServerFn({ method: "POST" })
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      return await dbUpdateEnrollmentStatus({
        userId: context.user.id,
        courseId: data.courseId,
        status: "active",
      });
    } catch (err) {
      console.error(
        `Error accepting invitation for course ${data.courseId} and user ${context.user.id}`,
        err,
      );
      throw new Error("Could not accept invitation", { cause: err });
    }
  });

export const declineInvitation = createServerFn({ method: "POST" })
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      return await dbUpdateEnrollmentStatus({
        userId: context.user.id,
        courseId: data.courseId,
        status: "declined",
      });
    } catch (err) {
      console.error(
        `Error declining invitation for course ${data.courseId} and user ${context.user.id}`,
        err,
      );
      throw new Error("Could not decline invitation", { cause: err });
    }
  });
