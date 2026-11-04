import { authClient } from "@/lib/auth-client";
import { SubmitButton } from "@/components/submit-button";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_auth/login")({
  component: LoginComponent,
});

interface FormCredentials {
  email: string;
  password: string;
}

function LoginComponent() {
  const [pendingSocial, setPendingSocial] = useState(false);
  const loginUser = async ({ value }: { value: FormCredentials }) => {
    form.setErrorMap({ onSubmit: undefined });
    try {
      const result = await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL: "/dashboard",
      });
      if (result.error) {
        form.setErrorMap({
          onSubmit: {
            form: "Could not login user. Check your email and/or password.",
            fields: {},
          },
        });
      }
    } catch (err) {
      console.error("Error on email signin", err);
      form.setErrorMap({
        onSubmit: {
          form: "Something went wrong. Please try again.",
          fields: {},
        },
      });
    }
  };
  const socialLogin = async () => {
    setPendingSocial(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      if (result.error) {
        form.setErrorMap({
          onSubmit: {
            form: "Could not login using social account (google).",
            fields: {},
          },
        });
      }
    } catch (err) {
      console.error("Error with social sign-in", err);
    } finally {
      setPendingSocial(false);
    }
  };

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: loginUser,
  });
  return (
    <div className="flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <h2 className="text-2xl my-4">Login</h2>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(error) =>
            typeof error === "string" ? (
              <div role="alert" className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="h-6 w-6 shrink-0 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>{error}</span>
              </div>
            ) : null
          }
        </form.Subscribe>
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
          <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <SubmitButton label="Login" submittingLabel="Logging in" isSubmitting={isSubmitting} />
        )}
      </form.Subscribe>
          <Link
            to="/sign-up"
            className="link link-hover text-xs font-semibold underline"
          >
            Sign up
          </Link>
        </div>
      </form>
      <div className="divider">OR</div>
      <div>
        <button
          className="btn bg-white text-black border-[#e5e5e5]"
          type="button"
          onClick={socialLogin}
        >
          {pendingSocial ? (
            <>
              <span className="loading loading-spinner"></span>Logging in
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
              >
                <g>
                  <path d="m0 0H512V512H0" fill="#fff"></path>
                  <path
                    fill="#34a853"
                    d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
                  ></path>
                  <path
                    fill="#4285f4"
                    d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"
                  ></path>
                  <path
                    fill="#fbbc02"
                    d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"
                  ></path>
                  <path
                    fill="#ea4335"
                    d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
                  ></path>
                </g>
              </svg>
              Login with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}
