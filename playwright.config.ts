import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3100",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Port chosen away from the app's default 3000 so a running dev server
    // (pointed at the real Turso DB) can never be reused by the tests.
    command: "npx vite dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: {
      // Point the app at an isolated local libsql file instead of the .env
      // Turso database. Other .env vars (BETTER_AUTH_SECRET etc.) are
      // inherited: db/index.ts loads dotenv, which does not override
      // already-set variables.
      TURSO_DATABASE_URL: "file:./tests/e2e/e2e-test.db",
      TURSO_AUTH_TOKEN: "local-e2e-file-db",
      BETTER_AUTH_URL: "http://localhost:3100",
    },
  },
});
