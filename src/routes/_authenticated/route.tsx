import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/auth-functions";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { router } from "better-auth/api";

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
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/login" });
        },
      },
    });
  };
  return (
    <div>
      {user && (
        <button className="btn" onClick={handleLogout}>
          Signout
        </button>
      )}
      <Outlet />
    </div>
  );
}
