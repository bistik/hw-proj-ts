import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import {
  clearAssignmentExample,
  seedAssignments,
  seedCourse,
  seedEnrollment,
  seedQuestions,
} from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #79: the AI questions tab lets the course author generate
// questions through an LLM. Red phase: this spec pins the access rule
// from the issue — only the course author can use the form. The
// author-page guard (getAssignmentById returns null for a non-author,
// so the router renders 404) keeps the form out of reach for everyone
// else, and the student view has no AI questions tab at all.
//
// The generate happy path needs a stand-in for the LLM service. Issue
// #81 tracks that spec: OPENCODE_BASE_URL can now point the chat
// completions client at a local mock service. The PR #80 review also
// requires: the generate form stays disabled until the assignment has
// an example (no LLM call needed for that case).

test.describe("AI questions (issue #79)", () => {
  test("only the course author can reach the AI questions form", async ({
    page,
  }) => {
    await ensureSignedUp(OTHER_USER);
    const courseId = await seedCourse(OTHER_USER.email, {
      title: `AI questions author-only course ${Date.now()}`,
      description:
        "Course authored by another user for the AI questions issue.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "AI questions author-only assignment",
    ]);
    await seedQuestions(assignmentId, ["Another author's seeded question"]);
    await seedEnrollment(TEST_USER.email, courseId);

    // TEST_USER is enrolled but is not the author: the author's
    // assignment page stays closed, so its AI questions form cannot be
    // reached. The router renders its not-found page instead.
    await loginViaUi(page, TEST_USER);
    await page.goto(`/assignments/${assignmentId}`);
    await expect(page.getByText("404 - not found")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "AI questions" }),
    ).toHaveCount(0);

    // The same assignment stays reachable through the student page, and
    // the student view never shows the AI questions tab.
    await page.goto(`/student/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Go to question #1")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "AI questions" }),
    ).toHaveCount(0);
  });

  test("the generate form stays disabled until the assignment has an example", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `AI questions no-example course ${Date.now()}`,
      description:
        "Course for the AI questions no-example case (PR #80 review).",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "AI questions no-example assignment",
    ]);
    await clearAssignmentExample(assignmentId);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: "AI questions" }).click();

    // The tab explains the missing example instead of showing a dead
    // form with no reason (PR #80 review).
    await expect(
      page.getByText(
        "No example yet. Add an example on the Edit assignment page first.",
      ),
    ).toBeVisible();

    // Without an example the LLM would receive an empty example block,
    // so the generate button stays disabled (PR #80 review). The server
    // fn rejects the request as well.
    await expect(
      page.getByRole("button", { name: "Generate questions" }),
    ).toBeDisabled();
  });
});
