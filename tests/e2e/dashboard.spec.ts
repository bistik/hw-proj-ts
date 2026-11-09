import { expect, test } from "@playwright/test";
import {
  ensureSignedUp,
  expectRedirectedToLogin,
  loginViaUi,
} from "./helpers/auth";
import { seedCourse, seedEnrollment } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

/**
 * Seeds a course authored by OTHER_USER with an "invited" enrollment row for
 * TEST_USER — the shape the dashboard surfaces as an accept/decline
 * invitation. Returns the course id and title so callers can scope their
 * assertions to this run's unique rows.
 */
async function seedInvitationForTestUser(): Promise<{
  courseId: number;
  title: string;
}> {
  await ensureSignedUp(OTHER_USER);
  const title = `Invitation course ${Date.now()}`;
  const courseId = await seedCourse(OTHER_USER.email, {
    title,
    description: "Course the E2E user is invited to enroll in.",
  });
  await seedEnrollment(TEST_USER.email, courseId, "invited");
  return { courseId, title };
}

test.describe("dashboard", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    await expectRedirectedToLogin(page, "/dashboard");
  });

  test("greets the logged-in user and shows dashboard links", async ({
    page,
  }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Welcome back! E2E User/ }),
    ).toBeVisible();

    // Asserted by href rather than name: navbar.tsx also renders a "Courses"
    // link, so the accessible name alone would match multiple elements.
    await expect(page.locator('a[href="/student/courses"]')).toBeVisible();
    await expect(page.locator('a[href="/courses/new"]')).toBeVisible();
    await expect(page.locator('a[href="/lessons/new"]')).toBeVisible();
    await expect(page.locator('a[href="/assignments/new"]')).toBeVisible();
  });

  test("redirects away from /dashboard after logout", async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Dropdown logout is client-side (authClient.signOut + navigate): wait
    // for hydration or the click is swallowed and the URL never changes
    // (seen flaky under CI's slower machine). Mirrors loginViaUi's wait.
    await page.waitForLoadState("networkidle");

    // Logout lives behind the avatar dropdown menu (src/components/navbar.tsx).
    await page.getByRole("button", { name: "Navbar" }).click();
    await page.getByRole("link", { name: "Logout" }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("lists pending course invitations with accept and decline buttons", async ({
    page,
  }) => {
    const { title } = await seedInvitationForTestUser();

    await loginViaUi(page, TEST_USER);
    await page.goto("/dashboard");

    const invitationRow = page
      .getByRole("listitem")
      .filter({ hasText: `You are invited to enroll in ${title}` });
    await expect(invitationRow).toBeVisible();
    await expect(
      invitationRow.getByRole("button", { name: "accept" }),
    ).toBeVisible();
    await expect(
      invitationRow.getByRole("button", { name: "decline" }),
    ).toBeVisible();
  });

  test("accepting an invitation redirects to the course's student page", async ({
    page,
  }) => {
    const { courseId, title } = await seedInvitationForTestUser();

    await loginViaUi(page, TEST_USER);
    await page.goto("/dashboard");
    // Wait for hydration so the accept click is handled by React instead of
    // swallowed (the same dev-mode race loginViaUi documents).
    await page.waitForLoadState("networkidle");

    const invitationRow = page
      .getByRole("listitem")
      .filter({ hasText: `You are invited to enroll in ${title}` });
    await invitationRow.getByRole("button", { name: "accept" }).click();

    await expect(page).toHaveURL(new RegExp(`/student/courses/${courseId}$`));
  });

  test("declining an invitation removes it and stays on the dashboard", async ({
    page,
  }) => {
    const { title } = await seedInvitationForTestUser();

    await loginViaUi(page, TEST_USER);
    await page.goto("/dashboard");
    // Same hydration wait as the accept test.
    await page.waitForLoadState("networkidle");

    const invitationRow = page
      .getByRole("listitem")
      .filter({ hasText: `You are invited to enroll in ${title}` });
    await invitationRow.getByRole("button", { name: "decline" }).click();

    // Still on /dashboard, and the invitation is gone.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: `You are invited to enroll in ${title}` }),
    ).toHaveCount(0);
  });
});
