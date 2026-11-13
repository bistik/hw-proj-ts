// src/routes/index.tsx
import { getSession } from "@/lib/auth-functions";
import { WelcomeCard } from "@/components/welcome-card";
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
      <WelcomeCard title="Welcome to Lets do homework" />
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
