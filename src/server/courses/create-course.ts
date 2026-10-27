import { dbCreateCourse } from "@/db/courses/create-course";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createCourse = createServerFn({
  method: "POST",
})
  .validator(courseFormSchema)
  .middleware([authMiddleware])
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
