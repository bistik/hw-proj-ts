import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  return (
    <div>
      <h2>Welcome back! {user.name}</h2>
      <p>dashboard"!</p>
      <ul>
        <li>
          <Link to="/courses/new">New course</Link>
          <Link to="/lessons/new">New lesson</Link>
          <Link to="/assignments/new">New assignment</Link>
        </li>
      </ul>
    </div>
  );
}
