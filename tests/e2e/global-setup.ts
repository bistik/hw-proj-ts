import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Runs after Playwright has started the webServer (webServer comes first, see
// playwright.config.ts), so the seeded user can be created via the app's
// better-auth API rather than direct SQL (password hashing stays server-side).
import { TEST_USER } from "./test-user";

const DB_FILE = path.resolve(process.cwd(), "tests/e2e/e2e-test.db");
const BASE_URL = "http://localhost:3100";

export default async function globalSetup() {
  if (!existsSync(DB_FILE)) {
    console.log(`[e2e] creating schema in ${DB_FILE}`);
    execSync("npx drizzle-kit push --config=drizzle.e2e.config.ts --force", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  }

  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // better-auth rejects null-origin requests (MISSING_OR_NULL_ORIGIN);
      // present the app's own base URL, its only trusted origin.
      Origin: BASE_URL,
    },
    body: JSON.stringify(TEST_USER),
  });

  // Reruns must be idempotent: "User already exists" is fine, anything else
  // is a setup failure worth failing fast on.
  const body = await res.json();
  if (!res.ok && !/exist/i.test(JSON.stringify(body))) {
    throw new Error(
      `[e2e] failed to seed test user: ${res.status} ${JSON.stringify(body)}`,
    );
  }

  console.log(`[e2e] test user ready: ${TEST_USER.email}`);
}
