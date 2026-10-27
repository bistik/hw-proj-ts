import { dbCreateAssignment } from "@/db/assignments/create-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { assignmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createAssignment = createServerFn({ method: "POST" })
  .validator(assignmentFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);
    try {
      const result = await dbCreateAssignment({ ...data });
      return result;
    } catch (err) {
      console.error("Error in creating assignment", err);
      throw new Error("Could not create assignment.");
    }
  });
