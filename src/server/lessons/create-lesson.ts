import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateLesson } from "@/db/lessons/create-lesson";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { lessonFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createLesson = createServerFn({
  method: "POST",
})
  .validator(lessonFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);
    try {
      const result = await dbCreateLesson({ ...data });
      return result;
    } catch (err) {
      console.error(`Error in creating lesson record`, err);
      throw new Error("Could not create a lesson.", { cause: err });
    }
  });
