import { getEnrolledCourses } from "@/server/courses/get-course";
import { createFileRoute, Link } from "@tanstack/react-router";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
      {enrollments.map((enrollment) => (
        <Link
          to="/student/courses/$courseId"
          params={{ courseId: String(enrollment.course.id) }}
          className="card border rounded-md border-solid border-accent/40 hover:border-accent block transition-all duration-300 ease-out shadow-sm hover:shadow-md hover:shadow-accent/20"
          key={enrollment.id}
        >
          <div className="card-body">
            <h2 className="card-title">{enrollment.course.title}</h2>
            <p>{enrollment.course.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
