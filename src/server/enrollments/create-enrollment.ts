import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateEnrollment } from "@/db/enrollments/create-enrollment";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { enrollmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createEnrollment = createServerFn({ method: "POST" })
  .validator(enrollmentFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);
    try {
      return await dbCreateEnrollment({
        courseId: data.courseId,
        userId: data.userId,
      });
    } catch (err) {
      console.error("Error in enrolling a user", err);
      throw new Error("Could not enroll a user", { cause: err });
    }
  });
