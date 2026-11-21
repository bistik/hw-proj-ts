import { execSync } from "node:child_process";
import path from "node:path";

// Rate-limit variant of tests/e2e/global-setup.ts. It pushes the schema and
// switches the DB to WAL mode, but it does NOT seed the test user.
//
// Seeding calls the sign-up API. Sign-up is an email-sending endpoint, so
// the seed would consume one slot of the shared per-IP bucket. An empty
// bucket at the start keeps the spec's request budget exact.

const DB_FILE = path.resolve(process.cwd(), "tests/e2e/e2e-test.db");

export default async function globalSetup() {
  // Always push before use: the dev-server's libsql client creates an
  // empty DB file on first connection (see tests/e2e/global-setup.ts).
  // drizzle-kit push is idempotent.
  console.log(`[rate-limit] ensuring schema in ${DB_FILE}`);
  execSync("npx drizzle-kit push --config=drizzle.e2e.config.ts --force", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  // WAL mode: the dev-server process and the drizzle-kit client both
  // access the same file, and the default journal mode blocks readers.
  console.log("[rate-limit] enabling WAL journal mode");
  execSync(
    `node -e "import('@libsql/client').then(({createClient}) => createClient({url:'file:./tests/e2e/e2e-test.db', timeout:10_000}).execute('PRAGMA journal_mode = WAL')).then(r => console.log('[rate-limit] journal:', r.rows[0].journal_mode))"`,
    { stdio: "inherit", cwd: process.cwd() },
  );
}
