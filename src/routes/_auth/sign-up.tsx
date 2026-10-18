import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
});

interface FormCredentials {
  email: string;
  password: string;
  confirmPassword: string;
}

const createUser = async ({ value }: { value: FormCredentials }) => {
  alert(JSON.stringify(value, null, 2));
};

const defaultCredentials: FormCredentials = {
  email: "",
  password: "",
  confirmPassword: "",
};

const formValidators = {
  onChange: ({ value }: { value: string }) => {
    const result = z.email("Invalid email address").safeParse(value);
    return result.success ? undefined : result.error.issues[0].message;
  },
};

function RouteComponent() {
  const form = useForm({
    defaultValues: defaultCredentials,
    onSubmit: createUser,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <h2 className="text-2xl my-4">Sign up</h2>
      <form.Field
        name="email"
        validators={formValidators}
        children={(field) => (
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Email</legend>
            <input
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              type="email"
              className="input"
              placeholder="Email"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="label">{field.state.meta.errors.join(", ")}</p>
            )}
          </fieldset>
        )}
      />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          <span>Password</span>
        </legend>
        <input type="password" className="input" placeholder="Password" />
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          <span>Confirm Password</span>
        </legend>
        <input type="password" className="input" placeholder="Password" />
      </fieldset>
      <button className="btn bg-primary mt-2">Signup</button>
    </form>
  );
}
