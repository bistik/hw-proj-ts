import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assignments/new")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/assignments/new"!</div>;
}
