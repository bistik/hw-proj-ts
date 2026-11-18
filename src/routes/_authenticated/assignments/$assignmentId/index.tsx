import { TextField } from "@/components/text-field";
import { SubmitButton } from "@/components/submit-button";
import { questionFormSchema } from "@/schemas/course-schema";
import { getAssignmentById } from "@/server/assignments/get-assignment";
import { createQuestion } from "@/server/questions/create-question";
import { deleteQuestion } from "@/server/questions/delete-question";
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
    const questions = await getQuestions({ data: assignmentId });

    return { assignment, questions };
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

function AssignmentDetailComponent() {
  const { assignment, questions } = Route.useLoaderData();
  const router = useRouter();
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
  return (
    <div>
      <div className="breadcrumbs text-sm">
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
              Course
            </Link>
          </li>
          <li>Assignment: {assignment.title}</li>
        </ul>
      </div>
      <h2>
        Assignment title: {assignment.title}
        <Link
          to="/assignments/$assignmentId/edit"
          params={{ assignmentId: String(assignment.id) }}
          className="link ml-2"
        >
          Edit assignment
        </Link>
      </h2>
      {questions && (
        <>
          <h2>Questions:</h2>
          <ul>
            {questions?.map((question) => {
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
        </>
      )}
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
  );
}
