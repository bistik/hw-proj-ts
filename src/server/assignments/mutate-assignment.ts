import {
  dbCreateAssignment,
  dbUpdateAssignment,
} from "@/db/assignments/mutate-assignment";
import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import {
  assignmentFormSchema,
  assignmentUpdateFormSchema,
} from "@/schemas/course-schema";
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

export const updateAssignment = createServerFn({ method: "POST" })
  .validator(assignmentUpdateFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment || !assignment.courseId)
      throw new Error("Could not fetch assignment or course.");
    await requireUserOwnsCourse(assignment.courseId, context.user.id);

    try {
      return await dbUpdateAssignment(data);
    } catch (err) {
      console.error(`Error in updating assignment`, err);
      throw new Error("Could not update assignment", { cause: err });
    }
  });
