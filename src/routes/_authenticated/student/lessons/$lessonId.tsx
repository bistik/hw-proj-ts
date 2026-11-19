import Breadcrumbs from "@/components/common/breadcrumbs";
import { MarkdownView } from "@/components/markdown-view";
import { getStudentLesson } from "@/server/lessons/get-lesson";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/student/lessons/$lessonId",
)({
  loader: async ({ params }) => {
    const lessonId = Number(params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) throw notFound();

    // getStudentLesson only returns the lesson when the signed-in user has
    // an active/completed enrollment in the lesson's course, so an unknown
    // id and a non-enrolled student both fail here (the router throws them
    // to defaultNotFoundComponent).
    const lessonWithCourse = await getStudentLesson({ data: lessonId });
    if (!lessonWithCourse) throw notFound();

    return lessonWithCourse;
  },
  component: StudentLessonComponent,
});

function StudentLessonComponent() {
  const { lesson, courseTitle } = Route.useLoaderData();

  return (
    <div>
      {/* Breadcrumb: course title (link back to the student course page,
          not the author page — the visitor here is a student) > lesson
          title (the current page, text only). */}
      <Breadcrumbs
        items={[
          <Link
            key="course"
            to="/student/courses/$courseId"
            params={{ courseId: String(lesson.courseId) }}
          >
            {courseTitle}
          </Link>,
          <span key="lesson">{lesson.title}</span>,
        ]}
      />
      {/* The title is the page heading, like the h2 on the student course
          page. */}
      <h2 className="mb-6">{lesson.title}</h2>
      {/* The stored content is markdown, so render it as sanitized
          HTML (see MarkdownView). */}
      <MarkdownView content={lesson.content} />
    </div>
  );
}
