import { sendEmail } from "./send";
import { inviteEmail } from "./templates/invite";

type InviteInput = {
  to: string;
  /** Absent when the invitee is unregistered and has no known name. */
  name?: string;
  courseTitle: string;
  /** True when the invitee has no account yet (issue #31). */
  unregistered?: boolean;
};

/**
 * Dashboard link for the call-to-action button. Built from the app base URL
 * when one is configured (BETTER_AUTH_URL / APP_URL); without a base URL the
 * template simply renders without the button.
 */
function resolveAppUrl(): string | undefined {
  return (process.env.BETTER_AUTH_URL ?? process.env.APP_URL)?.trim().replace(
    /\/+$/,
    "",
  );
}

function resolveDashboardUrl(): string | undefined {
  const baseUrl = resolveAppUrl();
  if (!baseUrl) return undefined;
  return `${baseUrl}/dashboard`;
}

function resolveSignUpUrl(): string | undefined {
  const baseUrl = resolveAppUrl();
  if (!baseUrl) return undefined;
  return `${baseUrl}/sign-up`;
}

/**
 * Sends the invitation email when a student is invited to a course.
 * Never throws: a failed email must not block the invite flow.
 */
export async function sendInviteEmail(input: InviteInput): Promise<void> {
  try {
    await sendEmail(
      inviteEmail({
        to: input.to,
        name: input.name,
        courseTitle: input.courseTitle,
        // An unregistered invitee has no dashboard yet: the call to action
        // points at sign-up instead (issue #31).
        dashboardUrl: input.unregistered ? undefined : resolveDashboardUrl(),
        signUpUrl: input.unregistered ? resolveSignUpUrl() : undefined,
      }),
    );
  } catch (error) {
    console.error(`Failed to send invite email to ${input.to}`, error);
  }
}
