import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <form>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Email</legend>
        <input type="text" className="input" placeholder="Email" />
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend flex justify-between items-center w-full">
          <span>Password</span>
          <a href="#" className="link">
            Forgot password
          </a>
        </legend>
        <input type="password" className="input" placeholder="Password" />
      </fieldset>
      <div className="flex justify-between items-center w-full">
        <button className="btn bg-primary mt-2">Login</button>
        <Link
          to="/sign-up"
          className="link link-hover text-xs font-semibold underline"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}
