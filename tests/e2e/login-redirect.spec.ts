import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { seedCourse } from "./helpers/db";
import { TEST_USER } from "./test-user";

// Issue #47: a login page reached through a protected route must send the
// user back to the route they asked for, not always to /dashboard. The
// destination travels as a redirect search param on /login, produced by the
// _authenticated layout's beforeLoad.
test.describe("login redirects back to the original destination", () => {
  // The retry loop in loginViaUi burns three ~10s waitForURL timeouts when a
  // login does not reach its destination (the red phase of this spec), so
  // give the tests headroom over Playwright's 30s default.
  test.setTimeout(60_000);
  test("unauthenticated visitors land on /login with a redirect param", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Redirect course ${Date.now()}`,
      description: "Course requested by an unauthenticated visitor.",
    });

    await page.goto(`/courses/${courseId}`);

    // The _authenticated layout's beforeLoad bounces to /login and keeps the
    // requested destination in a redirect search param.
    await expect(page).toHaveURL(/\/login\?.*redirect=/);
    const redirectParam = new URL(page.url()).searchParams.get("redirect");
    expect(redirectParam).toContain(`/courses/${courseId}`);
  });

  test("a successful login returns the user to the requested course", async ({
    page,
  }) => {
    const title = `Return course ${Date.now()}`;
    const courseId = await seedCourse(TEST_USER.email, {
      title,
      description: "Course to return to after login.",
    });

    // Enter through the protected route: the helper's first navigation
    // bounces to /login?redirect=..., and after submitting the form the user
    // must go back to /courses/<id> instead of the hardcoded /dashboard
    // callback. waitFor therefore expects the course page, which fails while
    // the login route still ignores the redirect param.
    await loginViaUi(page, TEST_USER, {
      entry: `/courses/${courseId}`,
      waitFor: new RegExp(`/courses/${courseId}$`),
    });

    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  });
});
