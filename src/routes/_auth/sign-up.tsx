import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
});

interface FormCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const defaultCredentials: FormCredentials = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const formSchema = z
  .object({
    name: z.string().min(1, { message: "Name is required" }),
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
  const navigate = useNavigate();
  const createUser = async ({ value }: { value: FormCredentials }) => {
    await authClient.signUp.email(
      {
        email: value.email,
        name: value.name,
        password: value.password,
      },
      {
        onSuccess: async (ctx) => {
          // The flag tells the dashboard that this visit comes from a
          // successful sign-up, so it greets the user and asks them to
          // verify the email address (issue #60).
          await navigate({
            to: "/dashboard",
            search: { signUp: true },
            replace: true,
          });
        },
        onError: (ctx) => {
          alert(ctx.error.message);
        },
      },
    );
  };
  const form = useForm({
    defaultValues: defaultCredentials,
    onSubmit: createUser,
    validators: {
      onSubmit: formSchema,
      onBlur: formSchema,
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
      <form.Field name="name">
        {(field) => {
          const { errors, isTouched } = field.state.meta;
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Name</legend>
              <input
                value={field.state.value}
                onBlur={(e) => field.handleBlur()}
                onChange={(e) => field.handleChange(e.target.value)}
                type="text"
                className="input"
                placeholder="Name"
              />
              {errors.length > 0 && isTouched && (
                <p className="label text-error">{errors[0]?.message}</p>
              )}
            </fieldset>
          );
        }}
      </form.Field>
      <form.Field name="email">
        {(field) => {
          const { errors, isTouched } = field.state.meta;
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Email</legend>
              <input
                value={field.state.value}
                onBlur={(e) => field.handleBlur()}
                onChange={(e) => field.handleChange(e.target.value)}
                type="email"
                className="input"
                placeholder="Email"
              />
              {errors.length > 0 && isTouched && (
                <p className="label text-error">{errors[0]?.message}</p>
              )}
            </fieldset>
          );
        }}
      </form.Field>
      <form.Field name="password">
        {(field) => {
          const { errors, isTouched } = field.state.meta;
          return (
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
              {errors.length > 0 && isTouched && (
                <p className="label text-error">{errors[0]?.message}</p>
              )}
            </fieldset>
          );
        }}
      </form.Field>
      <form.Field name="confirmPassword">
        {(field) => {
          const { errors, isTouched } = field.state.meta;
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">
                <span>Confirm Password</span>
              </legend>
              <input
                value={field.state.value}
                onBlur={(e) => field.handleBlur()}
                onChange={(e) => field.handleChange(e.target.value)}
                type="password"
                className="input"
                placeholder="Password"
              />
              {errors.length > 0 && isTouched && (
                <p className="label text-error">{errors[0]?.message}</p>
              )}
            </fieldset>
          );
        }}
      </form.Field>
      {/* Issue #60: the button must not accept a second submission
          while better-auth creates the account. The label stays
          "Signup" (no "Signing up..." swap) so the accessible name is
          stable during the pending window; the daisyUI loading spinner
          marks the pending state instead. */}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <button
            className="btn bg-primary mt-2"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting && <span className="loading loading-spinner"></span>}
            Signup
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
