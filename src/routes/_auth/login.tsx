import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    // <div className="p-6 bg-base-200 rounded-box shadow-md w-full max-w-md">
    <form>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Email</legend>
        <input type="text" className="input" placeholder="Email" />
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Password</legend>
        <input type="password" className="input" placeholder="Password" />
      </fieldset>
      <button className="btn bg-primary mt-2">Login</button>
    </form>
    // </div>
  );
}
