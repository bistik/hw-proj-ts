import { expect, test, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { createCourseViaUi } from "./helpers/course";
import { getLessonIdByTitle, seedLesson } from "./helpers/db";

// Issue #25: the Content field of the lesson form is a plain textarea.
// It must become a WYSIWYG markdown editor (@uiw/react-md-editor) on
// /courses/<id>/lessons/new and /courses/<id>/lessons/<id>/edit.
// Acceptance items:
// 1. The new lesson page renders the editor instead of the plain textarea.
// 2. The editor shows a live preview that renders the typed markdown.
// 3. Toolbar commands insert markdown (bold wraps the word in **).
// 4. The edit page shows the editor prefilled with the lesson's content.
// 5. Content typed in the editor is saved with the lesson (create roundtrip).
//
// Selectors come from the @uiw/react-md-editor markup (v4.2.4, checked
// against the package source): the container div has class "w-md-editor",
// the value textarea has class "w-md-editor-text-input", and the preview
// pane has class "w-md-editor-preview" (default preview mode "live" shows
// it next to the textarea). Toolbar buttons carry aria-labels such as
// "Add bold text (ctrl + b)".
test.describe("markdown editor for lesson content", () => {
  // Extracts the numeric course id from a "/courses/<id>" path, as returned
  // by createCourseViaUi, so assertions can name exact routes.
  function courseIdOf(coursePath: string): number {
    const id = Number(coursePath.split("/")[2]);
    if (!Number.isInteger(id)) {
      throw new Error(`no course id in path "${coursePath}"`);
    }
    return id;
  }

  const editorOf = (page: Page) =>
    page.locator('fieldset:has-text("Content") .w-md-editor');
  const editorTextareaOf = (page: Page) =>
    page
      .locator('fieldset:has-text("Content") textarea.w-md-editor-text-input');

  test("the new lesson page uses a markdown editor for Content", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Md editor course ${Date.now()}`,
      description: "Course whose new lesson form must host a markdown editor.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/lessons/new`);
    await page.waitForLoadState("networkidle");

    // The editor container replaces the old plain textarea (the daisyUI
    // .textarea rendered by TextField multiline).
    const editor = editorOf(page);
    await expect(editor).toBeVisible();
    await expect(
      page.locator('fieldset:has-text("Content") textarea.textarea'),
    ).toHaveCount(0);

    // The toolbar exposes the formatting commands; check a representative
    // set instead of every default command.
    await expect(
      editor.getByRole("button", { name: "Add bold text (ctrl + b)" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Add italic text (ctrl + i)" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Insert title" }),
    ).toBeVisible();
  });

  test("the editor shows a live preview that renders the typed markdown", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Md preview course ${Date.now()}`,
      description: "Course whose editor must preview the typed markdown.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/lessons/new`);
    await page.waitForLoadState("networkidle");

    const editor = editorOf(page);
    await expect(editor).toBeVisible();

    await editorTextareaOf(page).fill("# Heading one\n**bold text**");

    // The live preview renders the markdown as HTML next to the textarea.
    await expect(
      page.locator(".w-md-editor-preview h1"),
    ).toHaveText(/Heading one/);
    await expect(
      page.locator(".w-md-editor-preview strong"),
    ).toHaveText("bold text");
  });

  test("a toolbar command inserts markdown around the text", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Md toolbar course ${Date.now()}`,
      description: "Course whose editor toolbar must apply formatting.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/lessons/new`);
    await page.waitForLoadState("networkidle");

    const editor = editorOf(page);
    await expect(editor).toBeVisible();

    // With the caret at the end of the word (fill leaves it there), the
    // bold command wraps the word under the caret.
    await editorTextareaOf(page).fill("hello");
    await editor
      .getByRole("button", { name: "Add bold text (ctrl + b)" })
      .click();
    await expect(editorTextareaOf(page)).toHaveValue("**hello**");
  });

  test("the edit page shows the editor prefilled with the lesson content", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Md edit course ${Date.now()}`,
      description: "Course whose lesson edit page must host a markdown editor.",
    });
    const courseId = courseIdOf(coursePath);
    const lessonContent = "# Seeded heading\n\n**seeded bold** text";
    const lessonId = await seedLesson(courseId, {
      title: `Md edit lesson ${Date.now()}`,
      content: lessonContent,
    });

    await page.goto(`/courses/${courseId}/lessons/${lessonId}/edit`);
    await page.waitForLoadState("networkidle");

    const editor = editorOf(page);
    await expect(editor).toBeVisible();

    // The editor starts from the lesson's stored markdown.
    await expect(editorTextareaOf(page)).toHaveValue(lessonContent);

    // And the preview renders it, like on the new lesson page.
    await expect(
      page.locator(".w-md-editor-preview h1"),
    ).toHaveText(/Seeded heading/);
    await expect(
      page.locator(".w-md-editor-preview strong"),
    ).toHaveText("seeded bold");
  });

  test("content typed in the editor is saved with the lesson", async ({
    page,
  }) => {
    await loginViaUi(page);

    const coursePath = await createCourseViaUi(page, {
      title: `Md save course ${Date.now()}`,
      description: "Course whose lesson must keep the markdown typed in.",
    });
    const courseId = courseIdOf(coursePath);

    await page.goto(`/courses/${courseId}/lessons/new`);
    await page.waitForLoadState("networkidle");

    const lessonTitle = `Md saved lesson ${Date.now()}`;
    const lessonContent = "# Saved heading\n\n**saved bold** text";
    await page.locator('fieldset:has-text("Title") input').fill(lessonTitle);
    await editorTextareaOf(page).fill(lessonContent);
    await page.getByRole("button", { name: "Save Lesson" }).click();

    // On success the form navigates to the course page's lessons tab.
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}\\?tab=lessons$`),
    );

    // The roundtrip: the stored content comes back into the editor on the
    // edit page, byte for byte.
    const lessonId = await getLessonIdByTitle(courseId, lessonTitle);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}/edit`);
    await page.waitForLoadState("networkidle");
    await expect(editorTextareaOf(page)).toHaveValue(lessonContent);
  });
});
