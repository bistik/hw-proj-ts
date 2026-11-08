import { requireUserOwnsCourse } from "@/db/authz";
import { dbGetUnenrolledUsers } from "@/db/users/get-user";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const getUnenrolledUsers = createServerFn({ method: "GET" })
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      await requireUserOwnsCourse(data.courseId, context.user.id);
      return await dbGetUnenrolledUsers(data.courseId);
    } catch (err) {
      console.error(
        `Error fetching unenrolled users of course ${data.courseId}`,
        err,
      );
      throw new Error("Could not retrieve unenrolled users", { cause: err });
    }
  });
