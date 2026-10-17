import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await authClient.getSession();
    if (error) {
      console.error("Auth check failed:", error);
      throw new Error("Auth service is unavailable.");
    }
    if (!data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
});

function RouteComponent() {
  return (
    <div>
      Hello "/_authenticated"!
      <Outlet />
    </div>
  );
}
