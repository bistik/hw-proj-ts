import { execSync } from "node:child_process";
import path from "node:path";

// Runs after Playwright has started the webServer (webServer comes first, see
// playwright.config.ts), so the seeded user can be created via the app's
// better-auth API rather than direct SQL (password hashing stays server-side).
import { ensureSignedUp } from "./helpers/auth";
import { TEST_USER } from "./test-user";

const DB_FILE = path.resolve(process.cwd(), "tests/e2e/e2e-test.db");

export default async function globalSetup() {
  // Always push the schema before use. The webServer starts FIRST, and the
  // app's libsql client creates an EMPTY e2e-test.db on its first connection,
  // so guarding on file existence skipped the push in CI (fresh checkout) and
  // better-auth sign-up failed with "no such table: users". drizzle-kit push
  // is idempotent, so this is a quick no-op against an existing schema.
  console.log(`[e2e] ensuring schema in ${DB_FILE}`);
  execSync("npx drizzle-kit push --config=drizzle.e2e.config.ts --force", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  await ensureSignedUp(TEST_USER);

  // Switch the e2e DB to WAL mode (persistent for the file, idempotent):
  // the dev-server process and the per-worker helpers/db.ts clients both
  // access the same file, and in the default journal mode every write
  // blocks all readers, which shows up as SQLITE_BUSY elsewhere.
  console.log("[e2e] enabling WAL journal mode");
  execSync(
    `node -e "import('@libsql/client').then(({createClient}) => createClient({url:'file:./tests/e2e/e2e-test.db', timeout:10_000}).execute('PRAGMA journal_mode = WAL')).then(r => console.log('[e2e] journal:', r.rows[0].journal_mode))"`,
    { stdio: "inherit", cwd: process.cwd() },
  );

  console.log(`[e2e] test user ready: ${TEST_USER.email}`);
}
