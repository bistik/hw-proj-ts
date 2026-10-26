import { getLesson } from "@/server/lessons/get-lesson";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId/")({
  loader: async ({ params }) => {
    const lessonId = Number(params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) throw notFound();
    const lesson = await getLesson({ data: lessonId });
    if (!lesson) throw notFound();
    return { lesson };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { lesson } = Route.useLoaderData();

  return (
    <div className="card w-96 bg-base-100 card-lg shadow-sm">
      <div className="card-body">
        <h2 className="card-title">{lesson.title}</h2>
        <p className="whitespace-pre-wrap">{lesson.content}</p>
      </div>
    </div>
  );
}
