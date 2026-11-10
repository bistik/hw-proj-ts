/**
 * A rendered email, ready to be given to a transport.
 * Transports live in src/lib/email/send.ts; templates live in src/lib/email/templates.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Overrides the configured default sender. Rarely needed in practice:
   * the transport resolves a default from EMAIL_FROM.
   */
  from?: string;
};
