import { dbGetAssignmentsByCourse, dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
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

export const getAssignmentsByCourse = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      await requireUserOwnsCourse(data.courseId, context.user.id);
      return await dbGetAssignmentsByCourse(data.courseId);
    } catch (err) {
      console.error(`Error fetching assignments of course ${data.courseId}`, err);
      throw new Error("Error in fetching assignments", { cause: err });
    }
  });
