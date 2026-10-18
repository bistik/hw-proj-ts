import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  return (
    <div>
      <h2>Welcome back! {user.name}</h2>
      <p>dashboard"!</p>
    </div>
  );
}
