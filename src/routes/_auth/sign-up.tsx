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

const formSchema = z
  .object({
    email: z.email(),
    password: z
      .string()
      .min(8, { message: "Password must be atleast 8 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function RouteComponent() {
  const form = useForm({
    defaultValues: defaultCredentials,
    onSubmit: createUser,
    validators: {
      onSubmit: formSchema,
    },
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
      <form.Field name="email">
        {(field) => (
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Email</legend>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              type="email"
              className="input"
              placeholder="Email"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="label">{field.state.meta.errors[0]?.message}</p>
            )}
          </fieldset>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <fieldset className="fieldset">
            <legend className="fieldset-legend">
              <span>Password</span>
            </legend>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              type="password"
              className="input"
              placeholder="Password"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="label">{field.state.meta.errors[0]?.message}</p>
            )}
          </fieldset>
        )}
      </form.Field>
      <form.Field name="confirmPassword">
        {(field) => (
          <fieldset className="fieldset">
            <legend className="fieldset-legend">
              <span>Confirm Password</span>
            </legend>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              type="password"
              className="input"
              placeholder="Password"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="label">{field.state.meta.errors[0]?.message}</p>
            )}
          </fieldset>
        )}
      </form.Field>
      <button className="btn bg-primary mt-2">Signup</button>
    </form>
  );
}
