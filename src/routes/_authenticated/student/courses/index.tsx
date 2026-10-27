import { getEnrolledCourses } from "@/server/courses/get-course";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/student/courses/")({
  loader: async () => {
    const enrollments = await getEnrolledCourses();
    return { enrollments };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { enrollments } = Route.useLoaderData();
  if (!enrollments || enrollments.length === 0) {
    return <div>You're not enrolled in any courses yet.</div>;
  }
  return (
    <>
      {enrollments.map((enrollment) => (
        <div className="card card-side" key={enrollment.id}>
          <div className="card-body">
            <h2 className="card-title">{enrollment.course.title}</h2>
            <p>{enrollment.course.description}</p>
          </div>
        </div>
      ))}
    </>
  );
}
