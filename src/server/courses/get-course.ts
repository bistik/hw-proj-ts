import {
  dbGetCompleteCourseByUser,
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

export const getCompleteCourseByUser = createServerFn({
  method: "GET",
}).handler(async () => {
  const user = await getCurrentUser();
  try {
    const result = await dbGetCompleteCourseByUser(user.id);
    return result;
  } catch (err) {
    console.error(`Error in fetching course of user ${user.id}`, err);
    throw new Error("Could not fetch courses", { cause: err });
  }
});
