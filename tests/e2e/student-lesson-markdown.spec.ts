import { expect, test } from "@playwright/test";
import { ensureSignedUp, loginViaUi } from "./helpers/auth";
import { seedCourse, seedEnrollment, seedLesson } from "./helpers/db";
import { OTHER_USER, TEST_USER } from "./test-user";

// Issue #63: /student/lessons/<id> prints the lesson content as plain
// text. The page must render the stored markdown as HTML. Acceptance
// items:
// 1. The page renders the markdown as HTML elements.
// 2. The page does not run code from the markdown (script tags, event
//    handler attributes). The renderer must escape or remove them.
// 3. A link without target/rel gets target="_blank" and
//    rel="noopener noreferrer".
// 4. A link with its own target/rel keeps those attributes.
// 5. The page blocks dangerous link schemes (javascript:, data:).
test.describe("student lesson markdown rendering", () => {
  /**
   * Seeds a course (authored by OTHER_USER) plus one lesson with the
   * given markdown content, and enrolls TEST_USER in the course. The
   * student reaches the lesson only through the enrollment row, like
   * in real student usage.
   */
  async function seedMarkdownLesson(
    content: string,
  ): Promise<{ lessonId: number; lessonTitle: string }> {
    await ensureSignedUp(OTHER_USER);
    const courseId = await seedCourse(OTHER_USER.email, {
      title: `Md student course ${Date.now()}`,
      description: "Course whose lesson holds markdown for the student view.",
    });
    const lessonTitle = `Md student lesson ${Date.now()}`;
    const lessonId = await seedLesson(courseId, {
      title: lessonTitle,
      content,
    });
    await seedEnrollment(TEST_USER.email, courseId);
    return { lessonId, lessonTitle };
  }

  test("renders the lesson markdown as HTML", async ({ page }) => {
    const content = [
      "### Section heading",
      "",
      "Some **bold phrase** and *italic phrase* text.",
      "",
      "- First list item",
      "- Second list item",
      "",
      "Inline `code snippet` text.",
    ].join("\n");
    const { lessonId } = await seedMarkdownLesson(content);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    // The level-3 heading comes from the markdown. The lesson title is
    // a level-2 heading, so the levels cannot collide.
    await expect(
      page.getByRole("heading", { level: 3, name: "Section heading" }),
    ).toBeVisible();

    // Emphasis and code render as their HTML elements.
    await expect(
      page.locator("strong").filter({ hasText: "bold phrase" }),
    ).toBeVisible();
    await expect(
      page.locator("em").filter({ hasText: "italic phrase" }),
    ).toBeVisible();
    await expect(
      page.locator("code").filter({ hasText: "code snippet" }),
    ).toBeVisible();

    // The unordered list renders both list items.
    const list = page.getByRole("list");
    await expect(list).toBeVisible();
    await expect(
      list.getByRole("listitem").filter({ hasText: "First list item" }),
    ).toBeVisible();
    await expect(
      list.getByRole("listitem").filter({ hasText: "Second list item" }),
    ).toBeVisible();

    // The markdown source syntax stays hidden. The page must not show
    // the raw markdown as literal text.
    await expect(page.getByText("### Section heading")).toHaveCount(0);
    await expect(page.getByText("**bold phrase**")).toHaveCount(0);
  });

  test("does not run scripts or event handlers from the markdown", async ({
    page,
  }) => {
    const content = [
      "Para one.",
      "<script>window.__mdScriptRan = true;</script>",
      '<img src="/md-e2e-broken.png" onerror="window.__mdImgRan = true" />',
      "Para two.",
    ].join("\n");
    const { lessonId } = await seedMarkdownLesson(content);

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    // The page renders, and the plain text around the payloads stays.
    await expect(page.getByText("Para one.")).toBeVisible();
    await expect(page.getByText("Para two.")).toBeVisible();

    // The script tag never runs: the marker stays unset on window.
    const scriptRan = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__mdScriptRan,
    );
    expect(scriptRan).toBeUndefined();

    // The img onerror attribute never runs either. The image source is
    // a broken URL, so the handler fires only when it stays intact.
    const imgRan = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__mdImgRan,
    );
    expect(imgRan).toBeUndefined();

    // No element on the page keeps an on* event handler attribute from
    // the markdown. React uses synthetic events, so the app markup is
    // clean of inline handlers too.
    const handlerAttributeCount = await page
      .locator("*")
      .evaluateAll((elements) =>
        elements.filter((element) =>
          element
            .getAttributeNames()
            .some((name) => name.toLowerCase().startsWith("on")),
        ).length,
      );
    expect(handlerAttributeCount).toBe(0);
  });

  test("adds target and rel to a link that does not specify them", async ({
    page,
  }) => {
    const { lessonId } = await seedMarkdownLesson(
      'See [the student guide](https://example.test/guide) for details.',
    );

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    // The markdown link renders as a real anchor.
    const link = page.getByRole("link", { name: "the student guide" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://example.test/guide");

    // The renderer adds the safe link attributes when the markdown does
    // not set them: target="_blank" plus rel="noopener noreferrer".
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("keeps the target and rel that the link already specifies", async ({
    page,
  }) => {
    // Raw HTML in the markdown names both attributes, so the renderer
    // must not overwrite them with its defaults.
    const { lessonId } = await seedMarkdownLesson(
      '<a href="https://example.test/custom" target="_self" rel="noopener">custom guide link</a>',
    );

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    const link = page.getByRole("link", { name: "custom guide link" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://example.test/custom");
    await expect(link).toHaveAttribute("target", "_self");
    await expect(link).toHaveAttribute("rel", "noopener");
  });

  test("blocks javascript and data link URLs", async ({ page }) => {
    const { lessonId, lessonTitle } = await seedMarkdownLesson([
      'Click [run script](javascript:alert("e2e-xss")) to see.',
      "Open [data page](data:text/html;base64,PGI+eGQ8L2I+) instead.",
    ].join("\n"));

    await loginViaUi(page, TEST_USER);
    await page.goto(`/student/lessons/${lessonId}`);

    // Sanity: the page rendered the lesson at all.
    await expect(
      page.getByRole("heading", { name: lessonTitle }),
    ).toBeVisible();

    // No anchor on the page points to a dangerous scheme. A sanitizer
    // may strip the href or drop the whole anchor; either way the
    // rendered hrefs must be clean.
    const hrefs = await page.locator("a").evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );
    expect(hrefs.some((href) => /^\s*javascript:/i.test(href))).toBe(false);
    expect(hrefs.some((href) => /^\s*data:/i.test(href))).toBe(false);
  });
});
