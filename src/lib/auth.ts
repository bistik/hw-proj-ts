import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { env } from "@/lib/env";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { UnauthorizedError } from "@/lib/errors";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { sendVerificationEmail } from "@/lib/email/verification";
import { dbCreateEnrollment } from "@/db/enrollments/create-enrollment";
import { dbGetPendingInvitesByEmail } from "@/db/invites/get-invite";
import { dbDeleteInvite } from "@/db/invites/delete-invite";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // or "pg" or "mysql"
    usePlural: true,
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    // github: { // disabled for now - no sign-in button in the UI; re-add with
    //   clientId: env("GITHUB_CLIENT_ID"),          // GITHUB_CLIENT_ID/SECRET secrets
    //   clientSecret: env("GITHUB_CLIENT_SECRET"),
    // },
    google: {
      clientId: env("GOOGLE_CLIENT_ID"),
      clientSecret: env("GOOGLE_CLIENT_SECRET"),
    },
  },
  plugins: [tanstackStartCookies()],
  // Issue #26: better-auth owns the verification flow. sendOnSignUp sends a
  // verification email for every new sign-up, and the signed link in the
  // email carries the token that flips email_verified when followed. The
  // POST /api/auth/send-verification-email endpoint re-sends on request.
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, name: user.name, url });
    },
  },
  // Sends a welcome email through a better-auth hooks callback whenever a new
  // user row is written, so every sign-up (client form or API) is covered.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({ to: user.email, name: user.name });
          // Issue #31: invitations that were stored by email address while
          // the invitee had no account become enrollments now, so the
          // dashboard's accept/decline flow (getInvitations) picks them up.
          // This hook fires for every user-row creation path — password
          // sign-up (form or API) and a first-time OAuth sign-in, whose
          // user row better-auth writes on first sign-in — so a Google
          // invitee is converted too. Each conversion stands alone: one
          // failing invite must not block the others.
          const invites = await dbGetPendingInvitesByEmail(user.email);
          for (const invite of invites) {
            try {
              await dbCreateEnrollment({
                courseId: invite.courseId,
                userId: user.id,
              });
              await dbDeleteInvite(invite.id);
            } catch (error) {
              console.error(
                `Failed to convert invite ${invite.id} for ${user.email}`,
                error,
              );
            }
          }
        },
      },
    },
  },
});

export async function getCurrentUser() {
  const headers = getRequestHeaders();

  const session = await auth.api.getSession({ headers });

  if (!session) throw new UnauthorizedError();

  return session.user;
}
