import { sendEmail } from "./send";
import { verificationEmail } from "./templates/verification";

type VerificationInput = {
  to: string;
  name: string;
  /** Full verification link built by better-auth; carries the signed token. */
  url: string;
};

/**
 * Sends the email verification message for a new or unverified user.
 * Never throws: a failed email must not block the sign-up flow.
 */
export async function sendVerificationEmail(input: VerificationInput): Promise<void> {
  try {
    await sendEmail(verificationEmail(input));
  } catch (error) {
    console.error(`Failed to send verification email to ${input.to}`, error);
  }
}
