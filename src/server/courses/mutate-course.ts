import { dbCreateCourse, dbUpdateCourse } from "@/db/courses/mutate-course";
import {
  authMiddleware,
  verifiedMiddleware,
} from "@/middlewares/auth-middleware";
import {
  courseFormSchema,
  courseUpdateFormSchema,
} from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createCourse = createServerFn({
  method: "POST",
})
  .validator(courseFormSchema)
  .middleware([verifiedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const result = await dbCreateCourse({
        title: data.title,
        description: data.description,
        authorId: context.user.id,
      });
      return result;
    } catch (err) {
      console.error("Error in inserting a course record", err);
      throw new Error("Could not create a course.");
    }
  });

export const updateCourse = createServerFn({
  method: "POST",
})
  .validator(courseUpdateFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      return await dbUpdateCourse({
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        authorId: context.user.id,
      });
    } catch (err) {
      console.error("Error in updating a course record", err);
      throw new Error("Could not update the course.");
    }
  });
