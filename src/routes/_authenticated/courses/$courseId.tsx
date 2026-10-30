import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  loader: async ({ params }) => {
    const courseId = Number(params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();
    const course = await getCourseByIdAndAuthor({
      data: { courseId },
    });
    if (!course) throw notFound();
    return { course };
  },
});
