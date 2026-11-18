import { renderEmail } from "./layout";
import type { EmailMessage } from "../types";

type VerificationEmailInput = {
  to: string;
  name: string;
  /** Full verification link built by better-auth; carries the signed token. */
  url: string;
};

export function verificationEmail(input: VerificationEmailInput): EmailMessage {
  return {
    to: input.to,
    subject: "Verify your email address",
    ...renderEmail({
      title: "Verify your email address",
      body: [
        `Hi ${input.name},`,
        "Confirm this email address to activate your account.",
        "The link expires after 1 hour. If it no longer works, request a new one.",
      ],
      action: { label: "Verify email", url: input.url },
      footer: `You received this email because an account was created with ${input.to}.`,
    }),
  };
}
