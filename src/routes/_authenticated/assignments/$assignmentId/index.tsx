import { TextField } from "@/components/text-field";
import { SubmitButton } from "@/components/submit-button";
import {
  aiQuestionsFormSchema,
  questionFormSchema,
} from "@/schemas/course-schema";
import { getAssignmentById } from "@/server/assignments/get-assignment";
import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { generateQuestions } from "@/server/questions/generate-questions";
import {
  createQuestion,
  deleteQuestion,
} from "@/server/questions/mutate-question";
import { getQuestions } from "@/server/questions/get-questions";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import ConfirmModal from "@/components/confirm-modal";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/assignments/$assignmentId/",
)({
  loader: async ({ params }) => {
    const assignmentId = Number(params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) throw notFound();
    // The server fn returns null for an unknown id or a caller who is not
    // the course author; both cases render the router's
    // defaultNotFoundComponent instead of the assignment detail page.
    const assignment = await getAssignmentById({ data: { assignmentId } });
    if (!assignment) throw notFound();
    if (!assignment.courseId) throw notFound();
    // The breadcrumb names the course, so the loader fetches it too. The
    // author guard already ran in getAssignmentById; this read stays
    // author-scoped the same way. The two reads are independent, so they
    // run in parallel (PR #71 review).
    const [course, questions] = await Promise.all([
      getCourseByIdAndAuthor({ data: { courseId: assignment.courseId } }),
      getQuestions({ data: assignmentId }),
    ]);
    if (!course) throw notFound();

    return { assignment, course, questions };
  },
  component: AssignmentDetailComponent,
});

/**
 * One question row on the author's assignment detail page (issue #54).
 * The row carries an "Edit question" link and a "Delete question" button.
 * The delete opens the ConfirmModal (same flow as the delete-lesson
 * action, issue #40): the message names the question, and on Okay the
 * deleteQuestion server fn removes the row, then the route data reloads
 * and the row disappears. While the delete runs, the ConfirmModal keeps
 * the Okay button disabled and shows its spinner.
 */
function AuthorQuestionRow({
  questionId,
  assignmentId,
  questionText,
}: {
  questionId: number;
  assignmentId: number;
  questionText: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <li key={questionId}>
      {questionText}
      <Link
        to="/assignments/$assignmentId/questions/$questionId/edit"
        className="link ml-2"
        params={{
          questionId: String(questionId),
          assignmentId: String(assignmentId),
        }}
      >
        Edit question
      </Link>
      <button
        type="button"
        className="btn btn-error btn-sm ml-2"
        onClick={() => setDeleteOpen(true)}
      >
        Delete question
      </button>
      {/* The modal renders only while a delete is pending, so the page
          holds at most one ConfirmModal dialog: two rows never leave two
          closed .modal-box elements in the DOM at the same time. */}
      {deleteOpen && (
        <ConfirmModal
          open={deleteOpen}
          message={`Delete question "${questionText}"? This cannot be undone.`}
          onConfirm={async () => {
            // Remove the question row, then reload the route so the list
            // drops the row. The ConfirmModal keeps the button spinning
            // until this resolves, so the delete cannot be double-fired
            // while the page reloads.
            await deleteQuestion({ data: { questionId } });
            await router.invalidate();
          }}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </li>
  );
}

// Issue #70: the author's assignment detail page splits into three tabs.
// The labels double as the radios' accessible names, which the e2e specs
// use to address the tabs.
const assignmentDetailTabs = [
  { value: "questions", label: "Questions" },
  { value: "add-question", label: "Add question" },
  { value: "ai-questions", label: "AI questions" },
] as const;

type AssignmentDetailTab = (typeof assignmentDetailTabs)[number]["value"];

// The option values for the AI tab's "Number of questions" dropdown
// (issue #70: numbers 1 to 20). The aiQuestionsFormSchema count keeps
// the same bounds, so a submit can never exceed the dropdown.
const aiQuestionCountOptions = Array.from({ length: 20 }, (_, i) => i + 1);

function AssignmentDetailComponent() {
  const { assignment, course, questions } = Route.useLoaderData();
  const router = useRouter();
  // The Questions tab is the default: it holds the existing rows, so the
  // author lands on the list they most likely came to check.
  const [activeTab, setActiveTab] = useState<AssignmentDetailTab>("questions");
  const handleSubmit = async function ({
    value,
  }: {
    value: z.infer<typeof questionFormSchema>;
  }) {
    try {
      await createQuestion({ data: value });
      form.reset();
      router.invalidate();
    } catch (err) {
      console.error("Error in creating a question", err);
      throw new Error("Could not create a question", { cause: err });
    }
  };
  const form = useForm({
    defaultValues: {
      assignmentId: assignment.id,
      questionText: "",
      answer: "",
    },
    validators: {
      onSubmit: questionFormSchema,
      onBlur: questionFormSchema,
    },
    onSubmit: handleSubmit,
  });
  // Issue #79: the AI questions form is live. The submit builds the
  // prompt on the server from the assignment's stored example, so the
  // form carries only the count and the additional instruction. After
  // a generate, the route reloads so the Questions tab lists the new
  // rows.
  const handleGenerateSubmit = async function ({
    value,
  }: {
    value: z.infer<typeof aiQuestionsFormSchema>;
  }) {
    try {
      await generateQuestions({ data: value });
      aiForm.reset();
      router.invalidate();
    } catch (err) {
      console.error("Error in generating questions", err);
      throw new Error("Could not generate questions", { cause: err });
    }
  };
  const aiForm = useForm({
    defaultValues: {
      assignmentId: assignment.id,
      count: 1,
      additionalInstruction: "",
    },
    validators: {
      onSubmit: aiQuestionsFormSchema,
    },
    onSubmit: handleGenerateSubmit,
  });
  return (
    <div>
      {/* Vertical space separates the three page blocks: breadcrumbs,
          assignment title, tabs (issue #70 review). */}
      <div className="breadcrumbs text-sm mb-4">
        <ul>
          <li>
            <Link to="/courses" className="link">
              All courses
            </Link>
          </li>
          <li>
            <Link
              to="/courses/$courseId"
              params={{ courseId: String(assignment.courseId) }}
              className="link"
            >
              {course.title}
            </Link>
          </li>
          <li>Assignment: {assignment.title}</li>
        </ul>
      </div>
      {/* Issue #70 keeps the assignment title above the tab widget, on
          every tab. */}
      <h2 className="mb-6">
        Assignment title: {assignment.title}
        <Link
          to="/assignments/$assignmentId/edit"
          params={{ assignmentId: String(assignment.id) }}
          className="link ml-2"
        >
          Edit assignment
        </Link>
      </h2>
      {/* Same daisyUI tabs-border widget as the course detail page: one
          radio input per tab, and each radio immediately followed by its
          own tab-content div (daisyUI only shows the panel that directly
          follows the checked radio). */}
      <div className="tabs tabs-border" role="tablist">
        <input
          type="radio"
          name="assignment_tabs"
          className="tab"
          aria-label="Questions"
          checked={activeTab === "questions"}
          onChange={() => setActiveTab("questions")}
        />
        <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
          {/* The Questions panel stays mounted while other tabs show: the
              author can delete and edit from these rows, and the add-
              question flow's route reload must keep the updated list in
              the DOM for readers on the Add question tab. */}
          <h2>Questions</h2>
          {questions.length > 0 ? (
            <ul className="flex flex-col space-y-2">
              {questions.map((question) => {
                return (
                  <AuthorQuestionRow
                    key={question.id}
                    questionId={question.id}
                    assignmentId={assignment.id}
                    questionText={question.questionText}
                  />
                );
              })}
            </ul>
          ) : (
            <p>No questions yet</p>
          )}
        </div>

        <input
          type="radio"
          name="assignment_tabs"
          className="tab"
          aria-label="Add question"
          checked={activeTab === "add-question"}
          onChange={() => setActiveTab("add-question")}
        />
        <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
          {/* The add-question form stays mounted while other tabs show, so
              a submit that finishes while the author reads the list still
              leaves the reset form (and the reloaded list) addressable. */}
          <h2>Add question</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.Field name="questionText">
              {(field) => <TextField field={field} label="Question" multiline />}
            </form.Field>
            <form.Field name="answer">
              {(field) => <TextField field={field} label="Answer" multiline />}
            </form.Field>
            {/* Issue #51: the pending button disables and shows the daisyUI
                loading spinner, so a second submit cannot start while the
                createQuestion server fn is in flight. The label stays the
                same during the pending window, so the button's accessible
                name does not change mid-submit. */}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton
                  label="Add question"
                  submittingLabel="Add question"
                  isSubmitting={isSubmitting}
                />
              )}
            </form.Subscribe>
          </form>
        </div>

        <input
          type="radio"
          name="assignment_tabs"
          className="tab"
          aria-label="AI questions"
          checked={activeTab === "ai-questions"}
          onChange={() => setActiveTab("ai-questions")}
        />
        <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
          {/* The AI tab content renders only while the tab is active.
              Keeping it out of the DOM on the other tabs avoids a
              locator collision in the e2e specs: the "Number of
              questions" fieldset's legend contains "question", which
              would match the same fieldset locators the add-question
              form is addressed by. */}
          {activeTab === "ai-questions" && (
            <div>
              <h2>AI questions</h2>
              <p>{assignment.example ?? "No example yet"}</p>
              <p>Generate questions based on the examples</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  aiForm.handleSubmit();
                }}
              >
                <aiForm.Field name="count">
                  {(field) => (
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">
                        Number of questions
                      </legend>
                      <select
                        className="select"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(Number(e.target.value))
                        }
                      >
                        {aiQuestionCountOptions.map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </fieldset>
                  )}
                </aiForm.Field>
                <aiForm.Field name="additionalInstruction">
                  {(field) => (
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">
                        Additional instruction
                      </legend>
                      <textarea
                        className="textarea"
                        rows={3}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </fieldset>
                  )}
                </aiForm.Field>
                {/* Same pending pattern as the add-question form: the
                    button disables and shows the daisyUI loading spinner
                    while the LLM call runs, so a second submit cannot
                    start. The label stays the same, so the accessible
                    name does not change mid-submit. */}
                <aiForm.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <SubmitButton
                      label="Generate questions"
                      submittingLabel="Generate questions"
                      isSubmitting={isSubmitting}
                    />
                  )}
                </aiForm.Subscribe>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
