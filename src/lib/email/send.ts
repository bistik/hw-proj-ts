import type { EmailMessage } from "./types";

/**
 * Sends an email through the first configured transport:
 *
 * - MAILPIT_URL set (local dev): Mailpit HTTP API, messages appear in the
 *   Mailpit web UI (default http://localhost:8025).
 * - otherwise: the Cloudflare EMAIL binding ("send_email" in wrangler.jsonc),
 *   which is available in workerd (vite dev and deployed Workers), not in
 *   plain Node (E2E runs).
 * - no transport: the send is skipped with a warning, it never throws.
 *
 * A configured transport that fails (bad address, network error, ...) throws.
 * Callers decide how to handle that, usually by logging only.
 */

type MailpitSendAddress = {
  Email: string;
  Name?: string;
};

type MailpitSendPayload = {
  From: MailpitSendAddress;
  To: Array<MailpitSendAddress>;
  Subject?: string;
  Text?: string;
  HTML?: string;
  Tags?: Array<string>;
};

type CloudflareSendEmailBinding = {
  send(message: {
    to: string;
    from: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
};

type WorkersEnv = {
  EMAIL?: CloudflareSendEmailBinding;
} & Record<string, unknown>;

export type SendEmailResult =
  | {
      status: "sent";
      transport: "mailpit" | "cloudflare-binding";
    }
  | {
      status: "skipped";
    };

let workersEnv: WorkersEnv | null | undefined;

function getWorkersEnv(): Promise<WorkersEnv | null> {
  if (workersEnv !== undefined) return Promise.resolve(workersEnv);
  // "cloudflare:workers" only resolves inside workerd. The dynamic import and
  // the catch harden the e2e runs, which use plain Node SSR.
  return import("cloudflare:workers")
    .then((mod) => {
      workersEnv = (mod as { env?: WorkersEnv }).env ?? null;
      return workersEnv;
    })
    .catch(() => {
      workersEnv = null;
      return workersEnv;
    });
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readWorkersVar(workersEnv: WorkersEnv | null, name: string): string | undefined {
  const value = workersEnv?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveFrom(
  message: EmailMessage,
  workersEnv: WorkersEnv | null,
): string | undefined {
  return message.from ?? optionalEnv("EMAIL_FROM") ?? readWorkersVar(workersEnv, "EMAIL_FROM");
}

async function sendViaMailpit(
  baseUrl: string,
  from: string,
  message: EmailMessage,
): Promise<SendEmailResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/v1/send`;
  const payload: MailpitSendPayload = {
    From: { Email: from },
    To: [{ Email: message.to }],
    Subject: message.subject,
    Text: message.text,
    HTML: message.html,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Mailpit send failed (HTTP ${response.status} ${url}): ${body.slice(0, 200)}`);
  }

  return { status: "sent", transport: "mailpit" };
}

async function sendViaCloudflareBinding(
  from: string,
  message: EmailMessage,
  binding: CloudflareSendEmailBinding,
): Promise<SendEmailResult> {
  const result = await binding.send({
    to: message.to,
    from,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  console.info(`[email] sent "${message.subject}" to ${message.to} (${result.messageId})`);
  return { status: "sent", transport: "cloudflare-binding" };
}

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const mailpitUrl = optionalEnv("MAILPIT_URL");

  if (mailpitUrl) {
    const from = resolveFrom(message, null) ?? "no-reply@localhost";
    return sendViaMailpit(mailpitUrl, from, message);
  }

  const workersEnv = await getWorkersEnv();
  if (workersEnv?.EMAIL) {
    const from = resolveFrom(message, workersEnv);
    if (!from) {
      throw new Error(
        "EMAIL_FROM is not set. Add it to the Worker vars (wrangler.jsonc) to send email through the EMAIL binding.",
      );
    }
    return sendViaCloudflareBinding(from, message, workersEnv.EMAIL);
  }

  console.warn(
    `[email] no transport configured, skipped "${message.subject}" to ${message.to}. ` +
      "Set MAILPIT_URL in .env for local dev, or the send_email binding + EMAIL_FROM for production.",
  );
  return { status: "skipped" };
}
