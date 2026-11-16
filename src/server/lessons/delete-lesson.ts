import { dbDeleteLesson } from "@/db/lessons/delete-lesson";
import { dbGetLesson } from "@/db/lessons/get-lesson";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { deleteLessonSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * Deletes a lesson and its course_items outline row (issue #40). The
 * author check runs first (dbGetLesson joins on the course author), so a
 * non-author gets "Lesson not found" without touching any row.
 */
export const deleteLesson = createServerFn({ method: "POST" })
  .validator(deleteLessonSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const lesson = await dbGetLesson(data.lessonId, context.user.id);
    if (!lesson?.courseId) throw new Error("Lesson not found");
    try {
      return await dbDeleteLesson({
        courseId: lesson.courseId,
        lessonId: data.lessonId,
      });
    } catch (err) {
      console.error(`Error in deleting ${data.lessonId}`, err);
      throw new Error("Could not delete lesson", { cause: err });
    }
  });
