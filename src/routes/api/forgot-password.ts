import { auth } from "@/lib/auth";
import { checkEmailRateLimit } from "@/lib/email/rate-limit";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Issue #27: server-side endpoint for the forgot-password page's two forms
// (src/routes/_auth/forgot-password.tsx). The forms submit as native HTML
// forms, so they work before client JS hydrates; this route answers with a
// redirect that carries the outcome (error text or success) back to the page
// in the query string. Like /api/auth/$, this is a server-only route (no
// component), so importing auth here keeps the database code out of the
// client bundle.

// Same rules and message texts as the sign-up form
// (src/routes/_auth/sign-up.tsx); the messages are passed back to the page
// for display, so they must match what the spec expects.
const resetPasswordFormSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be atleast 8 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const FORGOT_PASSWORD_URL = "/forgot-password";

/** 303 See Other: after POST, the browser follows with GET. */
function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

export const Route = createFileRoute("/api/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const formData = await request.formData();
        const token = formData.get("token");
        if (typeof token === "string" && token !== "") {
          return handleResetPassword(token, formData);
        }
        return handleRequestReset(request, formData);
      },
    },
  },
});

/**
 * Request form: asks better-auth to email the reset link for the address.
 * The response never reveals whether the address exists: unknown addresses
 * get the same redirect as known ones (better-auth already answers this
 * way, and a failed send is only logged).
 */
async function handleRequestReset(
  request: Request,
  formData: FormData,
): Promise<Response> {
  const email = String(formData.get("email") ?? "").trim();
  // Issue #67: every request counts against the per-IP bucket and the
  // per-address bucket for the target address, before anything else. The
  // count must not depend on account existence or on the email format:
  // blocked and invalid requests consume their slot like any other.
  const limited = checkEmailRateLimit(request, email);
  if (limited) return limited;
  if (!z.email().safeParse(email).success) {
    return seeOther(
      `${FORGOT_PASSWORD_URL}?error=${encodeURIComponent(
        "Please enter a valid email address.",
      )}`,
    );
  }
  try {
    // Direct API call, no HTTP hop: better-auth generates the signed token
    // and fires sendResetPassword (src/lib/auth.ts), which emails the link
    // back to /forgot-password?token=...
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: FORGOT_PASSWORD_URL },
    });
  } catch (error) {
    console.error(`Failed to request password reset for ${email}`, error);
  }
  return seeOther(`${FORGOT_PASSWORD_URL}?sent=1`);
}

/**
 * Reset form: applies the new password against the signed token from the
 * emailed link. Validation failures and better-auth errors return to the
 * reset form (token preserved) with the message; success continues to the
 * login page.
 */
async function handleResetPassword(
  token: string,
  formData: FormData,
): Promise<Response> {
  const backWithError = (message: string) =>
    seeOther(
      `${FORGOT_PASSWORD_URL}?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
    );

  const parsed = resetPasswordFormSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Could not reset the password.";
    return backWithError(message);
  }
  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token },
    });
  } catch (error) {
    console.error("Failed to reset password", error);
    return backWithError(
      "Could not reset the password. The link may have expired; request a new one.",
    );
  }
  return seeOther("/login");
}
