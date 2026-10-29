import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/student/assignments/$assignmentId/questions/$questionId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      Hello
      "/_authenticated/student/assignments/$assignmentId/questions/$questionId"!
    </div>
  );
}
