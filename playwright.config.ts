import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // In CI the HTML report is published for download (see .github/workflows/
  // e2e.yml) and "github" annotations surface failures inline on the PR.
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
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
    command: "E2E=1 npx vite dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: {
      // Point the app at an isolated local libsql file instead of the .env
      // Turso database. These vars reach the app's Node SSR process directly
      // (E2E=1 in `command` drops the cloudflare vite plugin — see
      // vite.config.ts — which is what makes this work: its workerd runtime
      // neither inherits process env nor supports "file:" libsql URLs).
      TURSO_DATABASE_URL: "file:./tests/e2e/e2e-test.db",
      TURSO_AUTH_TOKEN: "local-e2e-file-db",
      BETTER_AUTH_URL: "http://localhost:3100",
    },
  },
});
