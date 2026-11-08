import { requireUserOwnsCourse } from "@/db/authz";
import { dbGetEnrolleesByCourse } from "@/db/enrollments/get-enrollment";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const getEnrolleesByCourse = createServerFn({ method: "GET" })
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      await requireUserOwnsCourse(data.courseId, context.user.id);
      return await dbGetEnrolleesByCourse(data.courseId);
    } catch (err) {
      console.error(`Error fetching enrollees of course ${data.courseId}`, err);
      throw new Error("Could not load enrollees", { cause: err });
    }
  });
