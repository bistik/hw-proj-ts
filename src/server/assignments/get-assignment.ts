import { dbGetAssignmentsByCourse, dbGetAssignmentByIdAndAuthor } from "@/db/assignments/get-assignment";
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
      // Author-scoped lookup: a caller who is not the course author gets
      // null, exactly like getCourseByIdAndAuthor. The route loader turns
      // null into notFound(), so no assignment data can leak to a non-author.
      const assignment = await dbGetAssignmentByIdAndAuthor(
        data.assignmentId,
        context.user.id,
      );
      if (!assignment || !assignment.courseId) return null;
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
