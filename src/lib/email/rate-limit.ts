// Issue #67: rate limit for the public email-sending endpoints
// (POST /api/forgot-password and the better-auth endpoints
// POST /api/auth/sign-up/email, POST /api/auth/send-verification-email
// and POST /api/auth/request-password-reset).
//
// Contract (tests/rate-limit/rate-limit.spec.ts):
//  1. Requests for one target address stop at EMAIL_RATE_LIMIT_PER_ADDRESS.
//  2. The per-address limit applies to the address only.
//  3. Requests also count per client IP, up to EMAIL_RATE_LIMIT_PER_IP, and
//     the count must not depend on account existence.
//  4. The per-IP bucket is shared by all email-sending endpoints.
//  5. Every 429 carries a Retry-After header with a positive number of
//     seconds.
//
// Design:
//  - The limiter counts requests, not individual emails: one request
//    consumes one slot even when it triggers two emails.
//  - Blocked requests consume their slot too: a burst of blocked requests
//    must not restart the window or free the bucket.
//  - Fixed window per key: the window starts with the first request and
//    ends WINDOW_SECONDS later. The maps stay small in practice; expired
//    entries are pruned on every check.
//  - Counters live in this module's memory. One dev-server process holds
//    them, which is what the rate-limit suite relies on (it forbids
//    server reuse, see playwright.rate-limit.config.ts). A multi-instance
//    production deployment would need a shared store; that is out of
//    scope for this issue.
//  - The limiter always runs, also in dev and E2E mode (E2E=1): turning
//    it off there would make the contract untestable.

const DEFAULT_PER_ADDRESS = 10;
const DEFAULT_PER_IP = 100;
const DEFAULT_WINDOW_SECONDS = 900;

type Bucket = {
  /** Requests seen in the current window, blocked ones included. */
  count: number;
  /** Millisecond timestamp when the window ends and the count resets. */
  resetAt: number;
};

const addressBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function windowMs(): number {
  return (
    readPositiveInt("EMAIL_RATE_LIMIT_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS) *
    1000
  );
}

/**
 * Best-effort client IP. TanStack Start handlers only expose the Request,
 * so the address comes from proxy headers:
 *  - CF-Connecting-IP: Cloudflare sets it from the connection, so a client
 *    cannot spoof it. Cloudflare is the deploy target (wrangler deploy).
 *  - X-Forwarded-For: other proxies. Its first entry is client-controlled
 *    when Cloudflare is in front, so it is only a fallback.
 * Without such a header (local dev, E2E) every request falls back to one
 * shared key, which is exactly the "one client IP" model the contract
 * describes.
 */
export function clientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function prune(map: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
}

/**
 * Consumes one slot in the bucket for `key`. Returns the seconds left
 * until the window resets when the bucket is over its limit, or null
 * when the request may pass.
 */
function consume(
  buckets: Map<string, Bucket>,
  key: string,
  limit: number,
  now: number,
): { allowed: boolean; retryAfterSeconds: number } {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs() };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response("Too many requests. Please try again later.", {
    status: 429,
    headers: {
      "Content-Type": "text/plain",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

/**
 * Counts one email-sending request against the shared per-IP bucket and,
 * when `address` is given, the per-address bucket for that target address.
 *
 * Returns a 429 Response (contract 5) when a limit is exceeded, or null
 * when the request may continue. Both buckets are charged before the
 * check, so a blocked request still consumes its slots (a blocked burst
 * must not keep the bucket open).
 */
export function checkEmailRateLimit(
  request: Request,
  address?: string,
): Response | null {
  const now = Date.now();
  prune(addressBuckets, now);
  prune(ipBuckets, now);

  const perIp = consume(
    ipBuckets,
    clientIp(request),
    readPositiveInt("EMAIL_RATE_LIMIT_PER_IP", DEFAULT_PER_IP),
    now,
  );
  const perAddress = address
    ? consume(
        addressBuckets,
        address.trim().toLowerCase(),
        readPositiveInt("EMAIL_RATE_LIMIT_PER_ADDRESS", DEFAULT_PER_ADDRESS),
        now,
      )
    : null;

  if (!perIp.allowed) return tooManyRequests(perIp.retryAfterSeconds);
  if (perAddress && !perAddress.allowed) {
    return tooManyRequests(perAddress.retryAfterSeconds);
  }
  return null;
}
