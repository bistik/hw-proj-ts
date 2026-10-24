import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/assignments/$assignmentId/questions/$questionId/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      Hello "/_authenticated/assignments/$assignmentId/questions/$questionId/"!
    </div>
  );
}
