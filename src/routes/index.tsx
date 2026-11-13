// src/routes/index.tsx
import { getSession } from "@/lib/auth-functions";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

// Issue #15: the homepage shows guests a welcome page and sends logged-in
// users straight to /dashboard (same server-fn session check as the
// _authenticated layout, but redirecting the other way).
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Home,
});

function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-base-100 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold">
          LDH
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome to Lets do homework
        </h1>
        <p className="text-sm opacity-70">
          Learning is a treasure that will follow its owner everywhere.
        </p>
      </div>
      <div className="flex gap-4">
        <Link to="/sign-up" className="btn btn-primary">
          Sign up
        </Link>
        <Link to="/login" className="btn btn-ghost">
          Log in
        </Link>
      </div>
    </div>
  );
}
