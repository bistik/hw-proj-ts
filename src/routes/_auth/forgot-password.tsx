import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import FormErrorAlert from "@/components/form-error-alert";

// Issue #27: one page at /forgot-password. Without a token it shows the email
// request form; opened with ?token=<signed token> (the link the reset email
// carries) it shows the new password form.
//
// Both forms are native HTML forms that post to /api/forgot-password
// (src/routes/api/forgot-password.ts), which answers with a redirect carrying
// the outcome in the query string. No client JS is needed to submit, so the
// forms work before React hydrates.

const forgotPasswordSearchSchema = z.object({
  token: z.string().optional(),
  sent: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/_auth/forgot-password")({
  validateSearch: (search: Record<string, unknown>) =>
    forgotPasswordSearchSchema.catch({}).parse(search),
  component: ForgotPasswordComponent,
});

function ForgotPasswordComponent() {
  const { token, sent, error } = Route.useSearch();

  return (
    <div className="flex flex-col">
      {token ? (
        <ResetPasswordForm token={token} error={error} />
      ) : (
        <RequestResetForm sent={Boolean(sent)} error={error} />
      )}
    </div>
  );
}

interface RequestResetFormProps {
  sent: boolean;
  error?: string;
}

function RequestResetForm({ sent, error }: RequestResetFormProps) {
  return (
    <form method="post" action="/api/forgot-password">
      <h2 className="text-2xl my-4">Forgot password</h2>
      {sent ? (
        <div role="alert" className="alert alert-success">
          <span>
            If an account exists for this email, a reset link is on its way.
          </span>
        </div>
      ) : (
        <>
          {error && <FormErrorAlert errorMsg={error} />}
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Email</legend>
            <input
              name="email"
              type="email"
              required
              className="input"
              placeholder="Email"
            />
          </fieldset>
          <button type="submit" className="btn btn-primary my-4">
            Send reset email
          </button>
        </>
      )}
    </form>
  );
}

interface ResetPasswordFormProps {
  token: string;
  error?: string;
}

function ResetPasswordForm({ token, error }: ResetPasswordFormProps) {
  return (
    <form method="post" action="/api/forgot-password">
      <h2 className="text-2xl my-4">Reset password</h2>
      <input type="hidden" name="token" value={token} />
      {error && <FormErrorAlert errorMsg={error} />}
      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          <span>Password</span>
        </legend>
        <input
          name="password"
          type="password"
          required
          className="input"
          placeholder="Password"
        />
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          <span>Confirm Password</span>
        </legend>
        <input
          name="confirmPassword"
          type="password"
          required
          className="input"
          placeholder="Confirm Password"
        />
      </fieldset>
      <button type="submit" className="btn btn-primary my-4">
        Reset password
      </button>
    </form>
  );
}
