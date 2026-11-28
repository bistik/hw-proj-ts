import { expect, test, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { seedAssignments, seedCourse, seedQuestions } from "./helpers/db";
import { TEST_USER } from "./test-user";

// Issue #64: seven forms ran the whole schema in a form-level onBlur
// validator. One field blur then attached errors to every field,
// including fields the user did not reach.
//
// TanStack Form marks a field as touched when the user types into it
// (setFieldValue sets isTouched). The display components gate the error
// on isTouched. So a stale error showed under a field whose value was
// already valid, and it stayed until that field's own next blur.
//
// The fix keeps the whole schema on onSubmit only. Each form.Field now
// has a field-scoped onBlur validator (validators={{ onBlur: <schema>.
// shape.<field> }}), as PR #62 does on the lesson forms. A blur
// validates only the blurred field, so no stale error can attach to
// another field.
//
// These tests pin the fixed behavior:
// - A blur of one field must not attach an error to another field that
//   the user did not reach.
// - The blurred field's own error must show.
// - Submit must keep the whole-schema check, and a valid form must
//   still submit.

// Locators for the sign-up form (src/routes/_auth/sign-up.tsx). Each
// input is addressed through its fieldset legend, because two inputs
// share the placeholder "Password".
const signUpInputOf = (page: Page, legend: string) =>
  page.locator(`fieldset:has(legend:text-is("${legend}")) input`);
const signUpErrorOf = (page: Page, legend: string) =>
  page.locator(`fieldset:has(legend:text-is("${legend}")) .text-error`);

// Locators for the TextField-based forms (src/components/text-field.tsx):
// each field renders a fieldset whose legend names it. Every locator
// matches the legend exactly: has-text is a substring match on the whole
// fieldset, and a textarea's initial value is its DOM text content, so
// a seeded value can contain another legend's text and make a substring
// locator match two fieldsets.
const fieldsetInputOf = (page: Page, legend: string) =>
  page.locator(`fieldset:has(legend:text-is("${legend}")) input`);
const fieldsetTextareaOf = (page: Page, legend: string) =>
  page.locator(`fieldset:has(legend:text-is("${legend}")) textarea`);

test.describe("sign-up form (issue #64)", () => {
  test("typing a valid password shows no stale error under it", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    // The Name blur (at the Email fill's focus change) runs the whole
    // schema while the password is still empty. A form-level onBlur
    // validator then attaches the min-length error to the untouched
    // password field.
    await signUpInputOf(page, "Name").fill("Blur Password User");
    await signUpInputOf(page, "Email").fill("blur-password@example.test");
    await signUpInputOf(page, "Password").fill("longenough-pass");

    // The password now holds a valid value, and the user never blurred
    // it. Only a whole-schema blur ran against it. The stale error must
    // not show under a valid, typed-into field.
    await expect(
      page.getByText("Password must be atleast 8 characters"),
    ).toHaveCount(0);
  });

  test("a confirm-password mismatch shows no error before submit", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await signUpInputOf(page, "Name").fill("Blur Mismatch User");
    await signUpInputOf(page, "Email").fill("blur-mismatch@example.test");
    await signUpInputOf(page, "Password").fill("longenough-pass");
    // The Email blur (at the Password fill's focus change) ran the whole
    // schema while the confirm field was still empty, so the refine rule
    // attached "Passwords do not match" to the untouched confirm field.
    await signUpInputOf(page, "Confirm Password").fill("different-pass");

    // The cross-field rule must not run on a field blur. It stays on the
    // form-level onSubmit validator, so no error may show before submit.
    await expect(page.getByText("Passwords do not match")).toHaveCount(0);

    // Guard: submit keeps the whole-schema check. The mismatch error
    // appears only after the Signup click, and the submit is blocked.
    await page.getByRole("button", { name: "Signup" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("an empty name blur shows only the name error", async ({ page }) => {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    // Blur the empty Name field. Its own error must show. The fields the
    // user has not reached (Email, Password, Confirm Password) must show
    // no error: a field-scoped blur never validates them.
    await signUpInputOf(page, "Name").click();
    await signUpInputOf(page, "Email").click();

    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(signUpErrorOf(page, "Email")).toHaveCount(0);
    await expect(signUpErrorOf(page, "Password")).toHaveCount(0);
    await expect(signUpErrorOf(page, "Confirm Password")).toHaveCount(0);
  });
});

test.describe("new course form (issue #64)", () => {
  test("a title typed after the description shows no stale title error", async ({
    page,
  }) => {
    await loginViaUi(page);
    await page.goto("/courses/new");
    await page.waitForLoadState("networkidle");

    // Fill the Description first. The Description blur (at the Title
    // fill's focus change) runs the whole schema while the title is
    // still empty, so a form-level onBlur validator attaches the title
    // error to the untouched title field.
    await fieldsetTextareaOf(page, "Description").fill(
      "Description typed before the title.",
    );
    await fieldsetInputOf(page, "Title").fill("A title typed second");

    // The title now holds a valid value. The stale error from another
    // field's blur must not show under it.
    await expect(page.getByText("Title is required")).toHaveCount(0);

    // Guard: the valid form still submits. On success the form navigates
    // to the course list.
    await page.getByRole("button", { name: "Add course" }).click();
    await page.waitForURL(/\/courses\/?$/);
  });

  test("an empty title blur shows the error and blocks submit", async ({
    page,
  }) => {
    await loginViaUi(page);
    await page.goto("/courses/new");
    await page.waitForLoadState("networkidle");

    // Blur the empty Title field. Its own error must show, and it must
    // stay after the blocked submit.
    await fieldsetInputOf(page, "Title").click();
    await fieldsetTextareaOf(page, "Description").click();

    await expect(page.getByText("Title is required")).toBeVisible();

    await page.getByRole("button", { name: "Add course" }).click();
    await expect(page).toHaveURL(/\/courses\/new$/);
    await expect(page.getByText("Title is required")).toBeVisible();
  });
});

test.describe("edit course form (issue #64)", () => {
  // This form starts with valid prefilled values. The stale-error defect
  // needs an untouched invalid field, so no red test is possible here.
  // This guard pins the behavior the refactor must keep.
  test("clearing the title shows the error, and the valid form still saves", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Blur edit course ${Date.now()}`,
      description: "Course whose edit form keeps its blur validation.",
    });

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}/edit`);
    await page.waitForLoadState("networkidle");

    // Clear the title. The next focus change blurs it, and its own error
    // must show.
    await fieldsetInputOf(page, "Title").fill("");
    await fieldsetTextareaOf(page, "Description").fill(
      "Description typed after the clear.",
    );
    await expect(page.getByText("Title is required")).toBeVisible();

    // Guard: submit keeps the whole-schema check, so the empty title
    // blocks the save and the error stays.
    await page.getByRole("button", { name: "Update course" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}/edit$`));
    await expect(page.getByText("Title is required")).toBeVisible();

    // Guard: fixing the title and submitting again navigates to the
    // course page. Blur the fixed title first (the Description fill
    // moves the focus): the title's own blur clears its error, so the
    // layout settles before the click. A click that lands on a moving
    // button misses it — the same layout-shift defect the issue
    // describes.
    await fieldsetInputOf(page, "Title").fill("Fixed title");
    await fieldsetTextareaOf(page, "Description").fill(
      "Description typed after the fix.",
    );
    await page.getByRole("button", { name: "Update course" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
  });
});

test.describe("new assignment form (issue #64)", () => {
  test("a title typed after the example shows no stale title error", async ({
    page,
  }) => {
    // The form renders only when the author owns at least one course.
    await seedCourse(TEST_USER.email, {
      title: `Blur title course ${Date.now()}`,
      description: "Course whose assignment form keeps its blur scoped.",
    });

    await loginViaUi(page);
    await page.goto("/assignments/new");
    await page.waitForLoadState("networkidle");

    // Fill the Example first. The Example blur (at the Title fill's
    // focus change) runs the whole schema while the title is empty.
    await fieldsetTextareaOf(page, "Example").fill(
      "Example typed before the title.",
    );
    await fieldsetInputOf(page, "Title").fill("A title typed second");

    await expect(page.getByText("Title is required")).toHaveCount(0);
  });

  test("selecting a course shows no stale error under the select", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Blur select course ${Date.now()}`,
      description: "Course whose select must not keep a stale error.",
    });

    await loginViaUi(page);
    await page.goto("/assignments/new");
    await page.waitForLoadState("networkidle");

    // The Example blur (at the Title fill's focus change) runs the
    // whole schema while the course select still holds 0. A form-level
    // onBlur validator attaches the courseId error (0 passes the
    // number check and fails positive()) to the untouched select.
    await fieldsetTextareaOf(page, "Example").fill(
      "Example typed before the title.",
    );
    await fieldsetInputOf(page, "Title").fill("A title typed second");

    // Choosing a course touches the select, so the stale error would
    // show under it although a course is selected.
    await page
      .locator('fieldset:has(legend:text-is("Course")) select')
      .selectOption(String(courseId));

    await expect(page.getByText("Please select a valid course")).toHaveCount(0);
  });

  test("an empty title blur shows the title error", async ({ page }) => {
    await seedCourse(TEST_USER.email, {
      title: `Blur guard course ${Date.now()}`,
      description: "Course whose assignment form shows the blur error.",
    });

    await loginViaUi(page);
    await page.goto("/assignments/new");
    await page.waitForLoadState("networkidle");

    // Blur the empty Title field. Its own error must show.
    await fieldsetInputOf(page, "Title").click();
    await fieldsetTextareaOf(page, "Example").click();

    await expect(page.getByText("Title is required")).toBeVisible();
  });
});

test.describe("course new assignment form (issue #64)", () => {
  test("a title typed after the example shows no stale title error", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Course assignment blur ${Date.now()}`,
      description: "Course whose scoped form must not show stale errors.",
    });

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}/assignments/new`);
    await page.waitForLoadState("networkidle");

    await fieldsetTextareaOf(page, "Example").fill(
      "Example typed before the title.",
    );
    await fieldsetInputOf(page, "Title").fill("A title typed second");

    await expect(page.getByText("Title is required")).toHaveCount(0);
  });

  test("an empty title blur shows the title error", async ({ page }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Course assignment guard ${Date.now()}`,
      description: "Course whose assignment form shows the blur error.",
    });

    await loginViaUi(page);
    await page.goto(`/courses/${courseId}/assignments/new`);
    await page.waitForLoadState("networkidle");

    // Blur the empty Title field. Its own error must show.
    await fieldsetInputOf(page, "Title").click();
    await fieldsetTextareaOf(page, "Example").click();

    await expect(page.getByText("Title is required")).toBeVisible();
  });
});

test.describe("add question form (issue #64)", () => {
  // Both fields are required, so a blur of one field can attach a stale
  // error to the other. Both directions get a red test.
  test("an answer typed after the question shows no stale answer error", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Question answer blur ${Date.now()}`,
      description: "Course whose question form keeps its blur scoped.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Question answer blur assignment",
    ]);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("radio", { name: "Add question" }).click();

    // The Question blur (at the Answer fill's focus change) runs the
    // whole schema while the answer is still empty.
    await fieldsetTextareaOf(page, "Question").fill(
      "What is the meaning of life?",
    );
    await fieldsetTextareaOf(page, "Answer").fill("Forty two");

    await expect(page.getByText("Answer is required")).toHaveCount(0);
  });

  test("a question typed after the answer shows no stale question error", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Answer question blur ${Date.now()}`,
      description: "Course whose question form keeps its blur scoped.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Answer question blur assignment",
    ]);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("radio", { name: "Add question" }).click();

    // The Answer blur (at the Question fill's focus change) runs the
    // whole schema while the question is still empty.
    await fieldsetTextareaOf(page, "Answer").fill("Forty two");
    await fieldsetTextareaOf(page, "Question").fill(
      "What is the meaning of life?",
    );

    await expect(page.getByText("Question text is required")).toHaveCount(0);
  });

  test("an empty question blur shows the question error", async ({ page }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Question blur guard ${Date.now()}`,
      description: "Course whose question form shows the blur error.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Question blur guard assignment",
    ]);

    await loginViaUi(page);
    await page.goto(`/assignments/${assignmentId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("radio", { name: "Add question" }).click();

    // Blur the empty Question field. Its own error must show.
    await fieldsetTextareaOf(page, "Question").click();
    await fieldsetTextareaOf(page, "Answer").click();

    await expect(page.getByText("Question text is required")).toBeVisible();
  });
});

test.describe("edit question form (issue #64)", () => {
  // This form starts with valid prefilled values. The stale-error defect
  // needs an untouched invalid field, so no red test is possible here.
  // This guard pins the behavior the refactor must keep.
  test("clearing the question shows the error, and the valid form still saves", async ({
    page,
  }) => {
    const courseId = await seedCourse(TEST_USER.email, {
      title: `Edit question blur ${Date.now()}`,
      description: "Course whose question edit form keeps its validation.",
    });
    const [assignmentId] = await seedAssignments(courseId, [
      "Edit question blur assignment",
    ]);
    const [questionId] = await seedQuestions(assignmentId, [
      "Seeded question for the blur guard",
    ]);

    await loginViaUi(page);
    await page.goto(
      `/assignments/${assignmentId}/questions/${questionId}/edit`,
    );
    await page.waitForLoadState("networkidle");

    // Clear the question. The next focus change blurs it, and its own
    // error must show.
    await fieldsetTextareaOf(page, "Question").fill("");
    await fieldsetTextareaOf(page, "Answer").fill("Kept answer.");
    await expect(page.getByText("Question text is required")).toBeVisible();

    // Guard: submit keeps the whole-schema check, so the empty question
    // blocks the save and the error stays.
    await page.getByRole("button", { name: "Update question" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}/questions/${questionId}/edit$`),
    );
    await expect(page.getByText("Question text is required")).toBeVisible();

    // Guard: fixing the question and submitting again navigates to the
    // assignment page. Blur the fixed question first (the Answer fill
    // moves the focus): the question's own blur clears its error, so
    // the layout settles before the click. A click that lands on a
    // moving button misses it — the same layout-shift defect the
    // issue describes.
    await fieldsetTextareaOf(page, "Question").fill(
      "Fixed question",
    );
    await fieldsetTextareaOf(page, "Answer").fill("Kept answer.");
    await page.getByRole("button", { name: "Update question" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/assignments/${assignmentId}$`),
    );
  });
});
