import { getStudentCourse } from "@/server/courses/get-course";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/student/courses/$courseId/",
)({
  loader: async ({ params }) => {
    const courseId = Number(params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();

    const course = await getStudentCourse({ data: { courseId } });
    if (!course) throw notFound();

    return { course };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { course } = Route.useLoaderData();

  return (
    <div>
      <h2>{course.title}</h2>
      <ul>
        {course.lessons.map((lesson) => (
          <li key={lesson.id}>
            {lesson.title}
            <a href="#">Placeholder link to go to lesson</a>
          </li>
        ))}
      </ul>
      <ul>
        {course.assignments.map((assignment) => (
          <li key={assignment.id}>
            <Link
              to="/student/assignments/$assignmentId"
              params={{ assignmentId: String(assignment.id) }}
              className="link"
            >
              {assignment.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
