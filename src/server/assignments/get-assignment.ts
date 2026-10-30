import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getAssignmentById = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Assignment Id is required"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const assignment = await dbGetAssignment(data.assignmentId);
      if (!assignment) throw new Error("Assignment not found");
      if (!assignment.courseId)
        throw new Error("Course for assignment not found");
      await requireUserOwnsCourse(assignment.courseId, context.user.id);
      return assignment;
    } catch (err) {
      console.error(`Error fetching assignment ${data.assignmentId}`, err);
      throw new Error("Error in fetching assignment", { cause: err });
    }
  });
