import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  seedAssignmentExample,
  seedAssignments,
  seedCourse,
  seedQuestions,
} from "./helpers/db";
import { TEST_USER } from "./test-user";

// Issue #70: split the author's assignment detail page (/assignments/<id>)
// into three tabs — Questions, Add question, AI questions — and keep the
// assignment title above the tabs. The AI questions tab shows the
// assignment's Example text plus a generate form that is disabled for now.

/**
 * Seeds one course and one assignment owned by TEST_USER and returns the
 * assignment id. The example text comes from the shared seeder helper
 * (seedAssignmentExample), so the AI questions tab's assertion cannot go
 * stale if the seeder text changes (PR #71 review).
 */
async function seedAssignmentForAuthor(assignmentTitle: string) {
  const courseId = await seedCourse(TEST_USER.email, {
    title: `Tabs course ${Date.now()}`,
    description: "Course authored by the E2E test user for the tabs issue.",
  });
  const [assignmentId] = await seedAssignments(courseId, [assignmentTitle]);
  return { assignmentId, example: seedAssignmentExample(assignmentTitle) };
}

test.describe("assignment detail page tabs (issue #70)", () => {
  test("shows the three tabs with the assignment title kept above them", async ({
    page,
  }) => {
    const assignmentTitle = "Tabbed assignment";
    const { assignmentId } = await seedAssignmentForAuthor(assignmentTitle);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    // The page is a daisyUI tabs widget: the three radio inputs render the
    // tab buttons, like the course detail page's tabs-border widget.
    // exact: true keeps the Questions locator from also matching the
    // "AI questions" radio (name matching is substring by default).
    const questionsTab = page.getByRole("radio", {
      name: "Questions",
      exact: true,
    });
    const addQuestionTab = page.getByRole("radio", { name: "Add question" });
    const aiQuestionsTab = page.getByRole("radio", { name: "AI questions" });
    await expect(questionsTab).toBeVisible();
    await expect(addQuestionTab).toBeVisible();
    await expect(aiQuestionsTab).toBeVisible();

    // The assignment title stays on top of the tabs, on every tab.
    const titleHeading = page.getByRole("heading", {
      name: `Assignment title: ${assignmentTitle}`,
    });
    await expect(titleHeading).toBeVisible();

    await questionsTab.click();
    await expect(questionsTab).toBeChecked();
    await expect(titleHeading).toBeVisible();

    await addQuestionTab.click();
    await expect(addQuestionTab).toBeChecked();
    await expect(titleHeading).toBeVisible();

    await aiQuestionsTab.click();
    await expect(aiQuestionsTab).toBeChecked();
    await expect(titleHeading).toBeVisible();
  });

  test("the Questions tab lists existing questions with edit and delete actions", async ({
    page,
  }) => {
    const { assignmentId } = await seedAssignmentForAuthor(
      "Questions tab assignment",
    );
    await seedQuestions(assignmentId, [
      "First seeded question",
      "Second seeded question",
    ]);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: "Questions", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Questions", exact: true }),
    ).toBeVisible();

    // Each existing row shows its text plus the edit link and the delete
    // button (the actions from issues #51/#54, moved into this tab).
    for (const questionText of [
      "First seeded question",
      "Second seeded question",
    ]) {
      const row = page.locator("li").filter({ hasText: questionText });
      await expect(row).toHaveCount(1);
      await expect(row.getByRole("link", { name: "Edit question" })).toBeVisible();
      await expect(
        row.getByRole("button", { name: "Delete question" }),
      ).toBeVisible();
    }
  });

  test("the Add question tab shows the add-question form", async ({ page }) => {
    const { assignmentId } = await seedAssignmentForAuthor(
      "Add question tab assignment",
    );

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: "Add question" }).click();
    await expect(
      page.getByRole("heading", { name: "Add question", exact: true }),
    ).toBeVisible();

    // The existing add-question form lives in this tab: the Question and
    // Answer fields and the Add question submit button.
    await expect(
      page.locator('fieldset:has-text("Question") textarea'),
    ).toBeVisible();
    await expect(
      page.locator('fieldset:has-text("Answer") textarea'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add question" }),
    ).toBeVisible();
  });

  test("the AI questions tab shows the example and the disabled generate form", async ({
    page,
  }) => {
    const { assignmentId, example } = await seedAssignmentForAuthor(
      "AI questions tab assignment",
    );

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: "AI questions" }).click();
    await expect(
      page.getByRole("heading", { name: "AI questions", exact: true }),
    ).toBeVisible();

    // The tab shows the assignment's Example text.
    await expect(page.getByText(example)).toBeVisible();

    // The tab explains what the form does.
    await expect(
      page.getByText("Generate questions based on the examples"),
    ).toBeVisible();

    // [Number of questions] dropdown: its options are the numbers 1..20.
    const numberSelect = page.locator(
      'fieldset:has-text("Number of questions") select',
    );
    await expect(numberSelect).toBeVisible();
    const options = numberSelect.locator("option");
    await expect(options).toHaveCount(20);
    for (let value = 1; value <= 20; value++) {
      await expect(options.nth(value - 1)).toHaveText(String(value));
    }

    // [Additional instruction] textarea with 3 rows.
    const instructionTextarea = page.locator(
      'fieldset:has-text("Additional instruction") textarea',
    );
    await expect(instructionTextarea).toBeVisible();
    await expect(instructionTextarea).toHaveAttribute("rows", "3");

    // [Generate questions] button.
    const generateButton = page.getByRole("button", {
      name: "Generate questions",
    });
    await expect(generateButton).toBeVisible();

    // The whole form is disabled for now (issue #70: no AI backend yet).
    await expect(numberSelect).toBeDisabled();
    await expect(instructionTextarea).toBeDisabled();
    await expect(generateButton).toBeDisabled();
  });
});
