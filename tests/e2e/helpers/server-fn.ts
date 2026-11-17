import type { Page } from "@playwright/test";

// How long each client→server server-fn call stays pending. TanStack
// Start posts server fn calls to /_serverFn/<functionId>; the delay
// widens the in-flight window so tests can observe the pending state
// (disabled buttons, loading animation) deterministically.
const SERVER_FN_DELAY_MS = 500;

/**
 * Delays every server fn call the page makes. The specs that use it
 * trigger exactly one server fn call each (the move), so the delay
 * cannot slow anything else down. This holds because login posts to
 * /api/auth, not /_serverFn; if login ever becomes a server fn,
 * install this route after loginViaUi so it does not delay the login.
 *
 * Shared by the move up and move down specs (issues #43 and #44), so the
 * two specs cannot drift apart.
 */
export async function slowServerFnCalls(page: Page): Promise<void> {
  await page.route("**/_serverFn/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SERVER_FN_DELAY_MS));
    await route.continue();
  });
}
