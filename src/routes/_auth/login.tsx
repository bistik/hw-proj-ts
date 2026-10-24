import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: RouteComponent,
});

interface FormCredentials {
  email: string;
  password: string;
}

function RouteComponent() {
  const loginUser = async ({ value }: { value: FormCredentials }) => {
    await authClient.signIn.email({
      email: value.email,
      password: value.password,
      callbackURL: "/dashboard",
    });
  };
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: loginUser,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <h2 className="text-2xl my-4">Login</h2>
      <form.Field name="email">
        {(field) => {
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Email</legend>
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                type="email"
                className="input"
                placeholder="Email"
              />
            </fieldset>
          );
        }}
      </form.Field>
      <form.Field name="password">
        {(field) => {
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend flex justify-between items-center w-full">
                <span>Password</span>
                <a href="#" className="link">
                  Forgot password
                </a>
              </legend>
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                type="password"
                className="input"
                placeholder="Password"
              />
            </fieldset>
          );
        }}
      </form.Field>
      <div className="flex justify-between items-center w-full">
        <button className="btn bg-primary mt-2" type="submit">
          Login
        </button>
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
