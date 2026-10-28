import {
  dbGetCompleteCourseByUser,
  dbGetCourseByIdAndAuthor,
  dbGetCoursesByUser,
  dbGetEnrolledCourses,
  dbGetEnrollmentByCourseAndStudent,
} from "@/db/courses/get-course";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const getCoursesByUser = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return dbGetCoursesByUser(context.user.id);
  });

export const getCourseByIdAndAuthor = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return dbGetCourseByIdAndAuthor(data.courseId, context.user.id);
  });

export const getCompleteCourseByUser = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const result = await dbGetCompleteCourseByUser(context.user.id);
      return result;
    } catch (err) {
      console.error(`Error in fetching course of user ${context.user.id}`, err);
      throw new Error("Could not fetch courses", { cause: err });
    }
  });

export const getEnrolledCourses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const result = await dbGetEnrolledCourses(context.user.id);
      return result;
    } catch (err) {
      console.error(
        `Error in fetching enrolled course of user ${context.user.id}`,
        err,
      );
      throw new Error("Could not fetch enrolled courses", { cause: err });
    }
  });

export const getStudentCourse = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(courseByIdSchema)
  .handler(async ({ data, context }) => {
    try {
      const enrollment = await dbGetEnrollmentByCourseAndStudent(
        data.courseId,
        context.user.id,
      );
      if (!enrollment) return null;

      return enrollment.course;
    } catch (err) {
      console.error(`Error fetching student course ${data.courseId}`, err);
      throw new Error("Could not fetch student course", { cause: err });
    }
  });
