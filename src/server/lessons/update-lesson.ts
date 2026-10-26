import { dbGetLesson } from "@/db/lessons/get-lesson";
import { dbUpdateLesson } from "@/db/lessons/update-lesson";
import { getCurrentUser } from "@/lib/auth";
import { lessonUpdateFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const updateLesson = createServerFn({ method: "POST" })
  .validator(lessonUpdateFormSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    const lesson = await dbGetLesson(data.lessonId, user.id);
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
