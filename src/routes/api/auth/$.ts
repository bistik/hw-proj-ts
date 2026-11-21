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
]);

function isEmailSendingRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  const path = new URL(request.url).pathname;
  return EMAIL_SENDING_PATHS.has(path);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        if (isEmailSendingRequest(request)) {
          const limited = checkEmailRateLimit(request);
          if (limited) return limited;
        }
        return await auth.handler(request);
      },
    },
  },
});
