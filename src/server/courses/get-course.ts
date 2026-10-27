import {
  dbGetCompleteCourseByUser,
  dbGetCourseByIdAndAuthor,
  dbGetCoursesByUser,
} from "@/db/courses/get-course";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const getCoursesByUser = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return dbGetCoursesByUser(context.user.id);
  });

export const getCourseByIdAndAuthor = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return dbGetCourseByIdAndAuthor(data.courseId, context.user.id);
  });

export const getCompleteCourseByUser = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const result = await dbGetCompleteCourseByUser(context.user.id);
      return result;
    } catch (err) {
      console.error(`Error in fetching course of user ${context.user.id}`, err);
      throw new Error("Could not fetch courses", { cause: err });
    }
  });
