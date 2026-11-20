import { renderEmail } from "./layout";
import type { EmailMessage } from "../types";

type PasswordResetEmailInput = {
  to: string;
  name: string;
  /** Full reset link back to the forgot-password page; carries the signed token. */
  url: string;
};

export function passwordResetEmail(
  input: PasswordResetEmailInput,
): EmailMessage {
  return {
    to: input.to,
    subject: "Reset your password",
    ...renderEmail({
      title: "Reset your password",
      body: [
        `Hi ${input.name},`,
        "We received a request to reset the password for this account.",
        "Open the link to choose a new password. The link expires after 1 hour.",
      ],
      action: { label: "Reset password", url: input.url },
      footer: `You received this email because a password reset was requested for ${input.to}.`,
    }),
  };
}
