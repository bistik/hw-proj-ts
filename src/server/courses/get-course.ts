import {
  dbGetCourseByIdAndAuthor,
  dbGetCoursesByUser,
} from "@/db/courses/get-course";
import { getCurrentUser } from "@/lib/auth";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const getCoursesByUser = createServerFn({
  method: "GET",
}).handler(async () => {
  const user = await getCurrentUser();
  return dbGetCoursesByUser(user.id);
});

export const getCourseByIdAndAuthor = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    return dbGetCourseByIdAndAuthor(data.courseId, user.id);
  });
