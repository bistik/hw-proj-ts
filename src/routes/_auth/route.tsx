import { Outlet } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { WelcomeCard } from "@/components/welcome-card";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-screen items-center justify-center bg-base-100 gap-24">
      <WelcomeCard />
      <Outlet />
    </div>
  );
}
