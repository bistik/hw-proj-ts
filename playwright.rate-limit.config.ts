import { defineConfig, devices } from "@playwright/test";

// Issue #67: dedicated suite for the rate limit on email-sending endpoints.
//
// The main e2e suite must stay unaware of the rate limit: its specs send
// emails freely and would trip a low limit. This config starts a separate
// dev server (port 3101) with strict limits set through env vars. The spec
// in tests/rate-limit/ asserts the exact thresholds.
//
// Run it with: npm run test:rate-limit
// Do not run it together with npm run test:e2e. Both suites write to the
// same file DB (tests/e2e/e2e-test.db) and contend for it.

export default defineConfig({
  testDir: "./tests/rate-limit",
  globalSetup: "./tests/rate-limit/global-setup.ts",
  // One worker: same shared-file-DB reason as playwright.config.ts. Test
  // order also matters: the specs share one per-IP bucket and each test
  // documents how much of that bucket it consumes.
  workers: 1,
  // The rate-limit counters accumulate across tests. A retry would consume
  // the same bucket twice, so never retry.
  retries: 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: "http://localhost:3101",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Port away from both the app default (3000) and the e2e suite (3100).
    command: "E2E=1 npx vite dev --port 3101",
    url: "http://localhost:3101",
    // Never reuse a running server. The rate-limit counters live in the
    // dev-server process, so a reused server would carry counters from a
    // previous run and shift every threshold.
    reuseExistingServer: false,
    env: {
      // Same isolated local DB as the main e2e suite (see
      // playwright.config.ts for why E2E=1 makes these vars work).
      TURSO_DATABASE_URL: "file:./tests/e2e/e2e-test.db",
      TURSO_AUTH_TOKEN: "local-e2e-file-db",
      BETTER_AUTH_URL: "http://localhost:3101",
      // Mailpit transport (src/lib/email/send.ts). Local only: CI has no
      // Mailpit, and the email-count assertions self-skip there.
      ...(process.env.CI
        ? {}
        : {
            MAILPIT_URL: process.env.MAILPIT_URL ?? "http://localhost:8025",
            EMAIL_FROM: "no-reply@e2e.test",
          }),
      // The contract under test (tests/rate-limit/rate-limit.spec.ts). The
      // implementation must read these env vars. Production defaults may
      // differ; this suite pins low values so thresholds are exact.
      EMAIL_RATE_LIMIT_PER_ADDRESS: "3",
      EMAIL_RATE_LIMIT_PER_IP: "10",
      EMAIL_RATE_LIMIT_WINDOW_SECONDS: "900",
    },
  },
});
