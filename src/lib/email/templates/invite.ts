import { renderEmail } from "./layout";
import type { EmailMessage } from "../types";

type InviteEmailInput = {
  to: string;
  /** Absent when the invitee is unregistered and has no known name. */
  name?: string;
  courseTitle: string;
  /** Absolute dashboard URL; when absent the call-to-action button is skipped. */
  dashboardUrl?: string;
  /**
   * Absolute sign-up URL for an invitee without an account (issue #31). It
   * replaces the dashboard call to action: the invitee must create an
   * account with this address before the dashboard invitation appears.
   */
  signUpUrl?: string;
};

export function inviteEmail(input: InviteEmailInput): EmailMessage {
  const body = [
    `You have been invited to enroll in "${input.courseTitle}".`,
    ...(input.signUpUrl
      ? [
          "Sign up with this email address, then open your dashboard to accept or decline the invitation.",
        ]
      : input.dashboardUrl
        ? [
            `Open your dashboard to accept or decline the invitation: ${input.dashboardUrl}`,
          ]
        : ["Open your dashboard to accept or decline the invitation."]),
  ];
  const action = input.signUpUrl
    ? { label: "Create your account", url: input.signUpUrl }
    : input.dashboardUrl
      ? { label: "Go to your dashboard", url: input.dashboardUrl }
      : undefined;

  return {
    to: input.to,
    subject: `Invitation to course: ${input.courseTitle}`,
    ...renderEmail({
      title: input.name ? `Hi ${input.name}!` : "Hello!",
      body,
      action,
      footer: `You received this email because you were invited to ${input.courseTitle}.`,
    }),
  };
}
