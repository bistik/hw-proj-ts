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
  component: StudentCourseDetailComponent,
});

function StudentCourseDetailComponent() {
  const { course } = Route.useLoaderData();

  return (
    <div>
      <h2 className="mb-6">{course.title}</h2>
      <p className="mb-6">
        Points: {course.points.earned} / {course.points.possible}
      </p>
      {/* One card per course item, stacked in course_items.position order
          (issue #32), with the daisyUI card markup of the SubmissionCard /
          AnswerCard components. */}
      <div className="flex flex-col gap-6">
        {course.items.map((item) => (
          <div
            key={`${item.itemType}-${item.id}`}
            className="card w-full bg-base-100 border-2 border-base-300 shadow-md"
          >
            {/* Header strip: item title link, with the status badge on the
                right for assignments (like the grade mark on AnswerCard). */}
            <div className="flex items-center justify-between bg-base-300 px-4 py-2.5 rounded-t-[14px] border-b-2 border-base-300">
              <h2 className="card-title">
                {item.itemType === "lesson" ? (
                  <Link
                    to="/student/lessons/$lessonId"
                    params={{ lessonId: String(item.id) }}
                    className="link hover:font-bold hover:text-primary"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <Link
                    to="/student/assignments/$assignmentId"
                    params={{ assignmentId: String(item.id) }}
                    className="link hover:font-bold hover:text-primary"
                  >
                    {item.title}
                  </Link>
                )}
              </h2>
              {item.itemType === "assignment" && (
                // Status badge per card, like the enrollment roster badges on
                // the author course page: "submitted" only once the student's
                // submission has submitted_at set.
                <span
                  className={`badge ${
                    item.submitted ? "badge-success" : "badge-neutral"
                  }`}
                >
                  {item.submitted
                    ? "submitted"
                    : item.hasSubmission
                      ? "in progress"
                      : "not submitted"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
