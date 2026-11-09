import { expect, test } from "@playwright/test";
import {
  ensureSignedUp,
  expectRedirectedToLogin,
  loginViaUi,
  logoutViaUi,
} from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { seedEnrollment } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

test.describe("course detail page", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    // The id itself doesn't matter: the _authenticated layout's beforeLoad
    // redirect fires before any course loader runs.
    await expectRedirectedToLogin(page, "/courses/1");
  });

  test("author sees the Course Details and Enrollment tabs", async ({
    page,
  }) => {
    await loginViaUi(page);

    const title = `Tabs course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Authored by the E2E test user.",
    });

    await page.goto(coursePath);
    await expect(page).toHaveURL(/\/courses\/\d+$/);
    // Let the route's loaders (and React hydration) settle before touching
    // the tabs: a tab click issued while the initial loaders are still
    // pending can be dropped by the router (no history push, UI/URL desync).
    await page.waitForLoadState("networkidle");

    // The page is a daisyUI tabs-border widget: two radio inputs render the
    // tab buttons, one tab-content div per tab.
    const courseDetailsTab = page.getByRole("radio", {
      name: "Course Details",
    });
    const enrollmentTab = page.getByRole("radio", { name: "Enrollment" });
    await expect(courseDetailsTab).toBeVisible();
    await expect(enrollmentTab).toBeVisible();

    // Course Details is defaultChecked and shows the course.
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();

    // Switching tabs reveals the Enrollment form. The tabs are
    // React-controlled radios backed by the ?tab= search param: use click()
    // plus asserting the resulting state, since check()'s native "did the
    // input stay checked" verification races the SPA re-render triggered by
    // every tab-switch navigation.
    await enrollmentTab.click();
    await expect(page).toHaveURL(/tab=enrollments/);
    await expect(enrollmentTab).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "Invite a student" }),
    ).toBeVisible();

    // Switching back shows the course details again.
    await courseDetailsTab.click();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(courseDetailsTab).toBeChecked();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  });
  test("author sees the Assignments and Lessons tabs", async ({ page }) => {
    await loginViaUi(page);

    const title = `Lessons course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Course for checking Assignments and Lessons tabs.",
    });

    await page.goto(coursePath);
    // Let the route's loaders (and React hydration) settle: a tab click
    // issued while the initial loaders are still pending can be dropped by
    // the router (no history push, UI/URL desync).
    await page.waitForLoadState("networkidle");

    // The author should get two more tabs in the tabs-border widget.
    const assignmentsTab = page.getByRole("radio", { name: "Assignments" });
    const lessonsTab = page.getByRole("radio", { name: "Lessons" });
    await expect(assignmentsTab).toBeVisible();
    await expect(lessonsTab).toBeVisible();

    // The tabs are React-controlled radios backed by the ?tab= search
    // param: click() plus asserting the resulting UI state, since check()'s
    // native "did the input stay checked" verification races the SPA
    // re-render triggered by every tab-switch navigation.
    await assignmentsTab.click();
    await expect(page).toHaveURL(/tab=assignments/);
    await expect(assignmentsTab).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "Assignments" }),
    ).toBeVisible();

    await lessonsTab.click();
    await expect(page).toHaveURL(/tab=lessons/);
    await expect(lessonsTab).toBeChecked();
    await expect(page.getByRole("heading", { name: "Lessons" })).toBeVisible();
  });

  test("non-author gets a 404 instead of the course page", async ({ page }) => {
    // Login as the second seeded user and author a course that TEST_USER
    // must never be able to see.
    await ensureSignedUp(OTHER_USER);
    await loginViaUi(page, OTHER_USER);
    const title = `Not TEST_USER's course ${Date.now()}`;
    const coursePath = await createCourseViaUi(page, {
      title,
      description: "Authored by the second E2E user.",
    });
    await logoutViaUi(page);

    // The route loader (src/routes/_authenticated/courses/$courseId.tsx)
    // looks the course up by author; a logged-in user who is not the author
    // is thrown to the router's defaultNotFoundComponent.
    await loginViaUi(page, TEST_USER);
    await page.goto(coursePath);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Course Details" }),
    ).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Enrollment" })).toHaveCount(
      0,
    );
  });

  test.describe("enrollments tab", () => {
    // Extracts the numeric course id from a "/courses/<id>" path, as
    // returned by createCourseViaUi, for seeding enrollment rows directly
    // in the e2e DB (tests/e2e/helpers/db.ts).
    function courseIdOf(coursePath: string): number {
      const id = Number(coursePath.split("/")[2]);
      if (!Number.isInteger(id)) {
        throw new Error(`no course id in path "${coursePath}"`);
      }
      return id;
    }

    test("lists all enrollees", async ({ page }) => {
      await ensureSignedUp(OTHER_USER);
      await loginViaUi(page);

      const title = `Roster course ${Date.now()}`;
      const coursePath = await createCourseViaUi(page, {
        title,
        description: "Course with two seeded enrollees.",
      });
      const courseId = courseIdOf(coursePath);
      // Enroll every seeded user, the author included, to prove that the
      // roster shows all enrollees and not just one.
      await seedEnrollment(TEST_USER.email, courseId);
      await seedEnrollment(OTHER_USER.email, courseId);

      await page.goto(`${coursePath}?tab=enrollments`);
      await expect(page).toHaveURL(/tab=enrollments/);
      await expect(
        page.getByRole("radio", { name: "Enrollment" }),
      ).toBeChecked();

      // Each enrollee appears as an entry in the tab's roster list,
      // identified by the unique seeded email. Scoped to role=listitem so
      // the Enroll-a-student dropdown (role=option) cannot satisfy the
      // assertion.
      for (const user of [TEST_USER, OTHER_USER]) {
        const rosterEntry = page
          .getByRole("listitem")
          .filter({ hasText: user.email });
        await expect(rosterEntry).toBeVisible();
      }
    });

    test("Enroll a student dropdown hides already enrolled students", async ({
      page,
    }) => {
      await ensureSignedUp(OTHER_USER);
      await loginViaUi(page);

      const title = `Picker course ${Date.now()}`;
      const coursePath = await createCourseViaUi(page, {
        title,
        description: "Course with one seeded enrollee.",
      });
      const courseId = courseIdOf(coursePath);
      await seedEnrollment(OTHER_USER.email, courseId);

      await page.goto(`${coursePath}?tab=enrollments`);
      await expect(page).toHaveURL(/tab=enrollments/);
      await expect(
        page.getByRole("radio", { name: "Enrollment" }),
      ).toBeChecked();

      // The form and its Student select stay available: TEST_USER, the
      // author, has no enrollment row for this course.
      await expect(
        page.getByRole("heading", { name: "Invite a student" }),
      ).toBeVisible();
      const studentSelect = page.locator('fieldset:has-text("Student") select');
      await expect(studentSelect).toBeVisible();

      // An already enrolled student must not be selectable again.
      await expect(
        studentSelect.getByRole("option", { name: OTHER_USER.email }),
      ).toHaveCount(0);
    });

    test("shows an enrollment-status badge for each enrollee", async ({
      page,
    }) => {
      await ensureSignedUp(OTHER_USER);
      await loginViaUi(page);

      const title = `Badges course ${Date.now()}`;
      const coursePath = await createCourseViaUi(page, {
        title,
        description: "Course with enrollees in different statuses.",
      });
      const courseId = courseIdOf(coursePath);
      await seedEnrollment(TEST_USER.email, courseId, "active");
      await seedEnrollment(OTHER_USER.email, courseId, "dropped");

      await page.goto(`${coursePath}?tab=enrollments`);
      await expect(page).toHaveURL(/tab=enrollments/);
      await expect(
        page.getByRole("radio", { name: "Enrollment" }),
      ).toBeChecked();

      // Each enrollee's roster row shows a daisyUI badge (span.badge) with
      // the enrollment status. Scoping the badge to the listitem that holds
      // the email proves the badge sits on the same row as name and email.
      const testUserEntry = page
        .getByRole("listitem")
        .filter({ hasText: TEST_USER.email });
      await expect(testUserEntry).toBeVisible();
      await expect(testUserEntry.locator(".badge")).toHaveText("active");

      const otherUserEntry = page
        .getByRole("listitem")
        .filter({ hasText: OTHER_USER.email });
      await expect(otherUserEntry).toBeVisible();
      await expect(otherUserEntry.locator(".badge")).toHaveText("dropped");
    });

    test("enrolling a student through the form marks them as invited", async ({
      page,
    }) => {
      await ensureSignedUp(OTHER_USER);
      await loginViaUi(page);

      const title = `Invite course ${Date.now()}`;
      const coursePath = await createCourseViaUi(page, {
        title,
        description: "Course to invite the second user into.",
      });

      await page.goto(`${coursePath}?tab=enrollments`);
      await expect(page).toHaveURL(/tab=enrollments/);
      await expect(
        page.getByRole("radio", { name: "Enrollment" }),
      ).toBeChecked();
      // Let the route's loaders (and React hydration) settle: the Student
      // select is React-controlled, so selecting an option before its
      // onChange handler is attached would be reverted by hydration and the
      // form would submit with an empty user id.
      await page.waitForLoadState("networkidle");

      // Pick the second user (option text is "<name> - <email>") and submit.
      const studentSelect = page.locator('fieldset:has-text("Student") select');
      await studentSelect.selectOption({
        label: `${OTHER_USER.name} - ${OTHER_USER.email}`,
      });
      await page.getByRole("button", { name: "Send invite" }).click();

      // The newly enrolled student now appears in the roster with an
      // "invited" status badge.
      const rosterEntry = page
        .getByRole("listitem")
        .filter({ hasText: OTHER_USER.email });
      await expect(rosterEntry).toBeVisible();
      await expect(rosterEntry.locator(".badge")).toHaveText("invited");
    });
  });
});
