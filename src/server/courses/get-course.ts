import {
  dbGetCourseByIdAndAuthor,
  dbGetCoursesByUser,
  dbGetCoursesWithItemCountsByUser,
  dbGetEnrolledCourses,
  dbGetEnrollmentByCourseAndStudent,
} from "@/db/courses/get-course";
import {
  dbGetCourseItemsByCourse,
  type CourseItemView,
} from "@/db/course-items/get-course-items";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { courseByIdSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * One card on the student course page (issue #32): an outline row resolved
 * to its lesson or assignment. Assignment items carry the viewing student's
 * submission state for the status badge.
 */
export type StudentCourseItem =
  | {
      itemType: "lesson";
      id: number;
      title: string;
      position: number;
    }
  | {
      itemType: "assignment";
      id: number;
      title: string;
      position: number;
      /** The student has a submission record for the assignment. */
      hasSubmission: boolean;
      /** That record has submitted_at set (the student finished it). */
      submitted: boolean;
    };

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

/**
 * The course's outline rows in course_items.position order (issue #33), for
 * the author's Course Details tab. Returns null when the caller does not own
 * the course — same scoping pattern as getCourseByIdAndAuthor.
 */
export const getCourseItemsByAuthor = createServerFn({
  method: "GET",
})
  .validator(courseByIdSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<CourseItemView[] | null> => {
    const course = await dbGetCourseByIdAndAuthor(
      data.courseId,
      context.user.id,
    );
    if (!course) return null;
    return dbGetCourseItemsByCourse(data.courseId);
  });

export const getCoursesWithItemCountsByUser = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const result = await dbGetCoursesWithItemCountsByUser(context.user.id);
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

      // The student page lists one card per course item (issue #32), in
      // course_items.position order: the outline row decides the slot, the
      // lesson/assignment row provides the title (and, for assignments, the
      // student's submission state for the status badge).
      const course = enrollment.course;
      const lessonsById = new Map(
        course.lessons.map((lesson) => [lesson.id, lesson]),
      );
      const assignmentsById = new Map(
        course.assignments.map((assignment) => [assignment.id, assignment]),
      );

      const items: StudentCourseItem[] = [];
      for (const { itemType, itemId, position } of course.items) {
        if (itemType === "lesson") {
          const lesson = lessonsById.get(itemId);
          if (lesson) {
            items.push({
              itemType,
              id: lesson.id,
              title: lesson.title,
              position,
            });
          }
        } else {
          const assignment = assignmentsById.get(itemId);
          if (assignment) {
            items.push({
              itemType,
              id: assignment.id,
              title: assignment.title,
              position,
              hasSubmission: assignment.submissions.length > 0,
              submitted: assignment.submissions.some(
                (submission) => submission.submittedAt !== null,
              ),
            });
          }
        }
      }

      return { id: course.id, title: course.title, items };
    } catch (err) {
      console.error(`Error fetching student course ${data.courseId}`, err);
      throw new Error("Could not fetch student course", { cause: err });
    }
  });
