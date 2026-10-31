// Used only by E2E tests (see tests/e2e/global-setup.ts).
// Runs the same schema against an isolated local libsql file so tests never
// touch the dev/prod Turso database. Deliberately does NOT import
// "dotenv/config" to keep .env credentials out of the E2E run.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/*schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: "file:./tests/e2e/e2e-test.db",
  },
});
