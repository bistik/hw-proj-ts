import { getCoursesWithItemCountsByUser } from "@/server/courses/get-course";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/courses/")({
  loader: async () => {
    const courses = await getCoursesWithItemCountsByUser();
    return { courses };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { courses } = Route.useLoaderData();
  if (!courses || courses.length === 0) {
    return (
      <div className="flex justify-center items-center h-32">
        <div>
          No courses found.{" "}
          <Link to="/courses/new" className="link ml-2">
            Create a new course
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
      {courses.map((course) => (
        <div
          className="card border rounded-md border-solid border-accent/40 hover:border-accent block transition-all duration-300 ease-out shadow-sm hover:shadow-md hover:shadow-accent/20"
          key={course.id}
        >
          <div className="card-body">
            <h2 className="card-title">
              <Link
                to="/courses/$courseId"
                params={{ courseId: String(course.id) }}
                className="link"
              >
                {course.title}
              </Link>
            </h2>
            <p>{course.description}</p>
            <div className="card-actions justify-end">
              <Link
                to="/courses/$courseId"
                params={{ courseId: String(course.id) }}
                search={{ tab: "assignments" }}
                className="link"
              >
                {course.assignmentCount} assignments
              </Link>
              <Link
                to="/courses/$courseId"
                params={{ courseId: String(course.id) }}
                search={{ tab: "lessons" }}
                className="link"
              >
                {course.lessonCount} lessons
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
