import { dbCreateLesson } from "@/db/lessons/create-lesson";
import { lessonFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createLesson = createServerFn({
  method: "POST",
})
  .validator(lessonFormSchema)
  .handler(async ({ data }) => {
    const result = await dbCreateLesson({ ...data });
    return result;
  });
