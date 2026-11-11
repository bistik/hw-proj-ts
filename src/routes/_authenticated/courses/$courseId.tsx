import { createFileRoute, notFound } from "@tanstack/react-router";

// Layout route for /courses/$courseId/*. Each child route runs its own
// author/ownership guard, so this loader only validates the course id.
export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  loader: async ({ params }) => {
    const courseId = Number(params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();
    return { courseId };
  },
});
