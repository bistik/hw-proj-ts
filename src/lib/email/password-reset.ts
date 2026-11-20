import { sendEmail } from "./send";
import { passwordResetEmail } from "./templates/password-reset";

type PasswordResetInput = {
  to: string;
  name: string;
  /** Full reset link back to the forgot-password page; carries the signed token. */
  url: string;
};

/**
 * Sends the password reset email for a user who asked for a new password.
 * Never throws: a failed email must not block the reset request flow.
 */
export async function sendPasswordResetEmail(
  input: PasswordResetInput,
): Promise<void> {
  try {
    await sendEmail(passwordResetEmail(input));
  } catch (error) {
    console.error(`Failed to send password reset email to ${input.to}`, error);
  }
}
