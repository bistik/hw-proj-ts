import { dbGetCoursesByUser } from "@/db/courses/get-course";
import { createServerFn } from "@tanstack/react-start";

export const getCoursesByUser = createServerFn({
  method: "GET",
})
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const result = await dbGetCoursesByUser(userId);
    return result;
  });
