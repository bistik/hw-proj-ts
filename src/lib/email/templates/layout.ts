/**
 * Shared email layout. Produces a simple HTML body plus a plain text fallback.
 * Every template renders through this wrapper so all outgoing emails stay
 * visually consistent.
 *
 * Note: emails only support inline styles, so a global stylesheet cannot be used.
 */

export type EmailAction = {
  label: string;
  url: string;
};

export type EmailTemplateContent = {
  title: string;
  /** Body paragraphs. Rendered text is HTML-escaped by the layout. */
  body: Array<string>;
  /** Optional call-to-action button. */
  action?: EmailAction;
  /** Optional extra footer line (for example "why you got this email"). */
  footer?: string;
};

export type RenderedTemplate = {
  html: string;
  text: string;
};

const APP_NAME = "Lets do homework";
const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderEmail(content: EmailTemplateContent): RenderedTemplate {
  const paragraphs = content.body
    .map((line) => escapeHtml(line))
    .map(
      (escaped) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2937">${escaped}</p>`,
    )
    .join("");

  const action = content.action
    ? `<a href="${escapeHtml(content.action.url)}" style="display:inline-block;margin:0 0 24px;padding:10px 22px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600">${escapeHtml(content.action.label)}</a>`
    : "";

  const footerLine = content.footer
    ? `${escapeHtml(content.footer)}<br/>`
    : "";
  const footer = `${footerLine}${escapeHtml(APP_NAME)}&nbsp;&mdash;&nbsp;sent automatically, do not reply.`;

  const html = `<div style="background-color:#f3f4f6;padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:560px;border-collapse:collapse">
    <tr><td style="padding:0 0 4px;font-size:18px;font-weight:700;font-family:${FONT_STACK};color:#4f46e5">${escapeHtml(APP_NAME)}</td></tr>
    <tr><td style="padding:24px;background-color:#ffffff;border-radius:8px;font-family:${FONT_STACK}">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#111827">${escapeHtml(content.title)}</h1>
      ${paragraphs}
      ${action}
    </td></tr>
    <tr><td style="padding:12px 24px;font-size:12px;line-height:18px;color:#6b7280;font-family:${FONT_STACK}">${footer}</td></tr>
  </table>
</div>`;

  const textLines = [
    content.title,
    "",
    ...content.body,
    ...(content.action ? ["", `${content.action.label}: ${content.action.url}`] : []),
    ...(content.footer ? ["", content.footer] : []),
    `${APP_NAME} — sent automatically, do not reply.`,
  ];

  return { html, text: textLines.join("\n") };
}
