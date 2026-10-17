import { Outlet } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-screen items-center justify-center bg-base-100 gap-24">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold">
          LDH
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Lets do homework</h1>
        <p className="text-sm opacity-70">
          Learning is a treasure that will follow its owner everywhere.
        </p>
      </div>
      <Outlet />
    </div>
  );
}
