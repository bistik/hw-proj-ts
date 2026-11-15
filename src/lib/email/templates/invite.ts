import { renderEmail } from "./layout";
import type { EmailMessage } from "../types";

type InviteEmailInput = {
  to: string;
  name: string;
  courseTitle: string;
  /** Absolute dashboard URL; when absent the call-to-action button is skipped. */
  dashboardUrl?: string;
};

export function inviteEmail(input: InviteEmailInput): EmailMessage {
  return {
    to: input.to,
    subject: `Invitation to course: ${input.courseTitle}`,
    ...renderEmail({
      title: `Hi ${input.name}!`,
      body: [
        `You have been invited to enroll in "${input.courseTitle}".`,
        input.dashboardUrl
          ? `Open your dashboard to accept or decline the invitation: ${input.dashboardUrl}`
          : "Open your dashboard to accept or decline the invitation.",
      ],
      action: input.dashboardUrl
        ? { label: "Go to your dashboard", url: input.dashboardUrl }
        : undefined,
      footer: `You received this email because you were invited to ${input.courseTitle}.`,
    }),
  };
}
