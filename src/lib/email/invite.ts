import { sendEmail } from "./send";
import { inviteEmail } from "./templates/invite";

type InviteInput = {
  to: string;
  name: string;
  courseTitle: string;
};

/**
 * Dashboard link for the call-to-action button. Built from the app base URL
 * when one is configured (BETTER_AUTH_URL / APP_URL); without a base URL the
 * template simply renders without the button.
 */
function resolveDashboardUrl(): string | undefined {
  const baseUrl = (
    process.env.BETTER_AUTH_URL ?? process.env.APP_URL
  )?.trim();
  if (!baseUrl) return undefined;
  return `${baseUrl.replace(/\/+$/, "")}/dashboard`;
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
        dashboardUrl: resolveDashboardUrl(),
      }),
    );
  } catch (error) {
    console.error(`Failed to send invite email to ${input.to}`, error);
  }
}
