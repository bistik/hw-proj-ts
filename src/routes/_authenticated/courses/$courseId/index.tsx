import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  loader: async ({ params }) => {
    const course = await getCourseByIdAndAuthor({
      data: { courseId: Number(params.courseId) },
    });
    if (!course) throw notFound();
    return { course };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { course } = Route.useLoaderData();
  return (
    <>
      <h2>{course.title}</h2>
      <p>{course.description}</p>
    </>
  );
}
