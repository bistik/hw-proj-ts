import { requireUserOwnsCourse } from "@/db/authz";
import {
  dbCreateLesson,
  dbDeleteLesson,
  dbUpdateLesson,
} from "@/db/lessons/mutate-lesson";
import { dbGetLesson } from "@/db/lessons/get-lesson";
import { authMiddleware } from "@/middlewares/auth-middleware";
import {
  deleteLessonSchema,
  lessonFormSchema,
  lessonUpdateFormSchema,
} from "@/schemas/course-schema";
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

/**
 * Deletes a lesson and its course_items outline row (issue #40). The
 * author check runs first (dbGetLesson joins on the course author), so a
 * non-author gets "Lesson not found" without touching any row. The
 * validator carries only the lessonId: the server derives the courseId
 * from the lesson row and never trusts the client-sent course id.
 */
export const deleteLesson = createServerFn({ method: "POST" })
  .validator(deleteLessonSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const lesson = await dbGetLesson(data.lessonId, context.user.id);
    // The optional chain is not redundant: lessons.course_id is nullable in
    // the schema and in the migration that created the table, so a lesson
    // row without a course id is a possible state.
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
