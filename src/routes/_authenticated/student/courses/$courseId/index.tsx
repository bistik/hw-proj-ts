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
      <ul className="list">
        {course.lessons.map((lesson) => (
          <li key={lesson.id} className="list-row">
            <Link
              to="/student/lessons/$lessonId"
              params={{ lessonId: String(lesson.id) }}
              className="link"
            >
              {lesson.title}
            </Link>
          </li>
        ))}
      </ul>
      <ul>
        {course.assignments.map((assignment) => {
          // Status badge per row, like the enrollment roster badges on the
          // author course page: "submitted" only once the student's
          // submission has submitted_at set.
          const hasSubmission = assignment.submissions.length > 0;
          const submitted = assignment.submissions.some(
            (s) => s.submittedAt !== null,
          );
          const status = submitted
            ? "submitted"
            : hasSubmission
              ? "in progress"
              : "not submitted";
          return (
            <li key={assignment.id}>
              <Link
                to="/student/assignments/$assignmentId"
                params={{ assignmentId: String(assignment.id) }}
                className="link"
              >
                {assignment.title}
              </Link>
              <span className="badge badge-outline">{status}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
