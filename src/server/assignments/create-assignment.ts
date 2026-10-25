import { dbCreateAssignment } from "@/db/assignments/create-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { getCurrentUser } from "@/lib/auth";
import { assignmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createAssignment = createServerFn({ method: "POST" })
  .validator(assignmentFormSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    await requireUserOwnsCourse(data.courseId, user.id);
    try {
      const result = await dbCreateAssignment({ ...data });
      return result;
    } catch (err) {
      console.error("Error in creating assignment", err);
      throw new Error("Could not create assignment.");
    }
  });
