import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Runs after Playwright has started the webServer (webServer comes first, see
// playwright.config.ts), so the seeded user can be created via the app's
// better-auth API rather than direct SQL (password hashing stays server-side).
import { ensureSignedUp } from "./helpers/auth";
import { TEST_USER } from "./test-user";

const DB_FILE = path.resolve(process.cwd(), "tests/e2e/e2e-test.db");

export default async function globalSetup() {
  if (!existsSync(DB_FILE)) {
    console.log(`[e2e] creating schema in ${DB_FILE}`);
    execSync("npx drizzle-kit push --config=drizzle.e2e.config.ts --force", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  }

  await ensureSignedUp(TEST_USER);

  console.log(`[e2e] test user ready: ${TEST_USER.email}`);
}
