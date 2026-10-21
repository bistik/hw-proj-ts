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
        <li className="space-x-2">
          <Link to="/courses/new" className="link">
            New course
          </Link>
          <Link to="/lessons/new" className="link">
            New lesson
          </Link>
          <Link to="/assignments/new" className="link">
            New assignment
          </Link>
        </li>
      </ul>
    </div>
  );
}
