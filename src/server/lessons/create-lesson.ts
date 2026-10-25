import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateLesson } from "@/db/lessons/create-lesson";
import { getCurrentUser } from "@/lib/auth";
import { lessonFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createLesson = createServerFn({
  method: "POST",
})
  .validator(lessonFormSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    await requireUserOwnsCourse(data.courseId, user.id);
    try {
      const result = await dbCreateLesson({ ...data });
      return result;
    } catch (err) {
      console.error(`Error in creating lesson record`, err);
      throw new Error("Could not create a lesson.", { cause: err });
    }
  });
