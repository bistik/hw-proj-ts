import { sendEmail } from "./send";
import { welcomeEmail } from "./templates/welcome";

type WelcomeInput = {
  to: string;
  name: string;
};

/**
 * Sends the welcome email for a newly registered user.
 * Never throws: a failed email must not block the sign-up flow.
 */
export async function sendWelcomeEmail(input: WelcomeInput): Promise<void> {
  try {
    await sendEmail(welcomeEmail({ to: input.to, name: input.name }));
  } catch (error) {
    console.error(`Failed to send welcome email to ${input.to}`, error);
  }
}
