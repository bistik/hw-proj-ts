import { auth } from "@/lib/auth";
import { checkEmailRateLimit } from "@/lib/email/rate-limit";
import { createFileRoute } from "@tanstack/react-router";

// Issue #67: better-auth endpoints that send an email share the per-IP
// rate-limit bucket with /api/forgot-password (contract 4 in
// tests/rate-limit/rate-limit.spec.ts). The check runs before the
// better-auth handler, so a blocked request produces a 429 with
// Retry-After and triggers no email. Endpoints that send no email (for
// example sign-in) stay unlimited.

/** better-auth endpoint paths whose handler sends an email. */
const EMAIL_SENDING_PATHS = new Set([
  "/api/auth/sign-up/email", // verification + welcome email on create
  "/api/auth/send-verification-email", // re-send on request
  // Issue #67 review: better-auth registers this endpoint automatically
  // because the app passes emailAndPassword.sendResetPassword
  // (src/lib/auth.ts). It emails the same reset link as the custom
  // /api/forgot-password route, so it must be limited too.
  "/api/auth/request-password-reset",
]);

/** Endpoint paths whose POST body is JSON that carries the target address. */
const JSON_BODY_ADDRESS_PATHS = new Set(["/api/auth/request-password-reset"]);

function isEmailSendingRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  const path = new URL(request.url).pathname;
  return EMAIL_SENDING_PATHS.has(path);
}

/**
 * Reads the target address from the JSON body, so the per-address limit
 * (contract 1) applies to request-password-reset like to
 * /api/forgot-password. better-auth reads the original body itself, so
 * this clones the request before reading. Returns undefined when the body
 * is missing, not JSON, or has no email address: the request then counts
 * against the per-IP bucket only.
 */
async function addressFromBody(request: Request): Promise<string | undefined> {
  const path = new URL(request.url).pathname;
  if (!JSON_BODY_ADDRESS_PATHS.has(path)) return undefined;
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : undefined;
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        if (isEmailSendingRequest(request)) {
          const limited = checkEmailRateLimit(
            request,
            await addressFromBody(request),
          );
          if (limited) return limited;
        }
        return await auth.handler(request);
      },
    },
  },
});
