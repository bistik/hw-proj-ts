import Navbar from "@/components/navbar";
import { getSession } from "@/lib/auth-functions";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
    return { user: session.user };
  },
  component: BaseLayoutComponent,
});

function BaseLayoutComponent() {
  const { user } = Route.useRouteContext();
  return (
    <div>
      {user && <Navbar user={user} />}
      <div className="w-4/5 mx-auto my-8">
        <Outlet />
      </div>
    </div>
  );
}
