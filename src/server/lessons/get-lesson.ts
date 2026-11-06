import { dbGetLesson, dbGetLessonsByCourse } from "@/db/lessons/get-lesson";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getLesson = createServerFn({ method: "GET" })
  .validator(z.number().int().positive("Invalid lesson id"))
  .middleware([authMiddleware])
  .handler(async ({ data: lessonId, context }) => {
    try {
      return await dbGetLesson(lessonId, context.user.id);
    } catch (err) {
      console.error(`Error fetching lesson ${lessonId}`, err);
      throw new Error(`Could not load lesson`, { cause: err });
    }
  });

export const getLessonsByCourse = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      await requireUserOwnsCourse(data.courseId, context.user.id);
      return await dbGetLessonsByCourse(data.courseId);
    } catch (err) {
      console.error(`Error fetching lessons of course ${data.courseId}`, err);
      throw new Error("Error in fetching lessons", { cause: err });
    }
  });
