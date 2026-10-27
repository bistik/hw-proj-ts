import { dbGetLesson } from "@/db/lessons/get-lesson";
import { dbUpdateLesson } from "@/db/lessons/update-lesson";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { lessonUpdateFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const updateLesson = createServerFn({ method: "POST" })
  .validator(lessonUpdateFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const lesson = await dbGetLesson(data.lessonId, context.user.id);
    if (!lesson) throw new Error("Lesson not found");
    try {
      return await dbUpdateLesson(
        { title: data.title, content: data.content },
        data.lessonId,
      );
    } catch (err) {
      console.error(`Error in updating ${data.lessonId}`, err);
      throw new Error("Could not update lesson", { cause: err });
    }
  });
