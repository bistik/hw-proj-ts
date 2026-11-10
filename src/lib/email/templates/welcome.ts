import { renderEmail } from "./layout";
import type { EmailMessage } from "../types";

type WelcomeEmailInput = {
  to: string;
  name: string;
};

export function welcomeEmail(input: WelcomeEmailInput): EmailMessage {
  return {
    to: input.to,
    subject: "Welcome to Lets do homework!",
    ...renderEmail({
      title: `Welcome, ${input.name}!`,
      body: [
        "Your account is ready.",
        "Sign in with your email and password to explore your dashboard and courses.",
      ],
      footer: `You received this email because an account was created with ${input.to}.`,
    }),
  };
}
