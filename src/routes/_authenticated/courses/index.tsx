import { getCompleteCourseByUser } from "@/server/courses/get-course";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/courses/")({
  loader: async () => {
    const courses = await getCompleteCourseByUser();
    return { courses };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { courses } = Route.useLoaderData();
  return (
    <>
      {courses.map((course) => (
        <div className="card card-side" key={course.id}>
          <figure></figure>
          <div className="card-body">
            <h2 className="card-title">{course.title}</h2>
            <p>{course.description}</p>
            <ul className="list">
              {course.lessons.map((lesson) => (
                <li className="list-row" key={lesson.id}>
                  {lesson.title}
                </li>
              ))}
            </ul>
            <ul className="list">
              {course.assignments.map((assignment) => (
                <li className="list-row" key={assignment.id}>
                  <Link
                    to="/assignments/$assignmentId"
                    params={{ assignmentId: String(assignment.id) }}
                    className="link"
                  >
                    {assignment.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="card-actions justify-end">
              <Link to="/assignments/new" className="btn btn-info">
                Add assignment
              </Link>
              <Link to="/lessons/new" className="btn btn-info">
                Add lesson
              </Link>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
