import { dbCreateCourse } from "@/db/courses/create-course";
import { getCurrentUser } from "@/lib/auth";
import { courseFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createCourse = createServerFn({
  method: "POST",
})
  .validator(courseFormSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    const result = await dbCreateCourse({
      title: data.title,
      description: data.description,
      authorId: user.id,
    });
    return result;
  });
