/**
 * Helpers for the Mailpit HTTP API, used by the invite-email spec.
 *
 * Mailpit is the local dev SMTP sink: the app posts messages to
 * `POST {MAILPIT_URL}/api/v1/send` (src/lib/email/send.ts), and these
 * helpers read them back through the read API to assert on what the app
 * actually sent.
 */

// Same default as .env.example / src/lib/email/send.ts consumers.
const MAILPIT_URL = (process.env.MAILPIT_URL ?? "http://localhost:8025").replace(/\/+$/, "");

type MailpitAddress = {
  Address?: string;
  Name?: string;
};

/** Summary returned by /api/v1/search and /api/v1/messages. */
export type MailpitMessageSummary = {
  ID: string;
  From?: MailpitAddress;
  To?: MailpitAddress[];
  Subject?: string;
  Snippet?: string;
};

/** Full message returned by /api/v1/message/{ID}; adds the bodies. */
export type MailpitMessage = MailpitMessageSummary & {
  Text?: string;
  HTML?: string;
};

/**
 * True when a Mailpit server answers at MAILPIT_URL. Specs use this to
 * skip themselves where Mailpit is not running (CI, or local dev without
 * Mailpit) instead of failing.
 */
export async function isMailpitAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Polls Mailpit until a message addressed to `to` passes `predicate`, or
 * returns null after `timeoutMs`. Polling is needed because the send is
 * fire-and-forget from the test's point of view: the invite request
 * returns before (or without) the email landing in Mailpit.
 */
export async function waitForMailpitMessage(
  to: string,
  predicate: (message: MailpitMessageSummary) => boolean,
  timeoutMs = 10000,
): Promise<MailpitMessageSummary | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=100`,
    );
    if (response.ok) {
      const body = (await response.json()) as { messages?: MailpitMessageSummary[] };
      const match = (body.messages ?? []).find(predicate);
      if (match) return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

/** Fetches the full message (subject, text and HTML bodies) by its ID. */
export async function getMailpitMessage(id: string): Promise<MailpitMessage | null> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!response.ok) return null;
  return (await response.json()) as MailpitMessage;
}

/**
 * Counts the messages addressed to `to` that pass `predicate`. Reads the
 * mailbox exactly once (no polling), so a caller proving that no new email
 * arrived must first let the send settle — e.g. wait for another visible
 * effect of the request — before counting.
 */
export async function countMailpitMessages(
  to: string,
  predicate: (message: MailpitMessageSummary) => boolean,
): Promise<number> {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=100`,
  );
  if (!response.ok) return 0;
  const body = (await response.json()) as { messages?: MailpitMessageSummary[] };
  return (body.messages ?? []).filter(predicate).length;
}
