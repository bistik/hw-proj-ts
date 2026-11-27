import ConfirmModal from "@/components/confirm-modal";
import FormErrorAlert from "@/components/form-error-alert";
import ScoreModal from "@/components/score-modal";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { upsertAnswer } from "@/server/assignments/submissions/answers/create-answer";
import { getStudentAnswer } from "@/server/assignments/submissions/answers/get-answer";
import { getSubmission } from "@/server/assignments/submissions/get-submission";
import { submitAssignment } from "@/server/assignments/submissions/mutate-submission";
import {
  getStudentNextQuestion,
  getStudentPreviousQuestion,
  getStudentQuestion,
} from "@/server/questions/get-questions";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/student/assignments/$assignmentId/questions/$questionId",
)({
  // Issue #92: a return visit reuses the cached match. The default
  // "background" stale reload renders the cached state (isSubmitted =
  // false) while the loader runs again, so the answer form flashes for
  // a student who already submitted. The "blocking" mode waits for the
  // fresh loader data and shows the pending skeleton instead, so the
  // form never renders from the stale cached state.
  loader: {
    staleReloadMode: "blocking",
    handler: async ({ params }) => {
      const assignmentId = Number(params.assignmentId);
      if (!Number.isInteger(assignmentId) || assignmentId <= 0)
        throw notFound();

      const questionId = Number(params.questionId);
      if (!Number.isInteger(questionId) || questionId <= 0) throw notFound();

      const [
        questionResult,
        currentAnswer,
        nextQuestion,
        prevQuestion,
        submissionResult,
      ] = await Promise.all([
        getStudentQuestion({
          data: { assignmentId, questionId },
        }),
        getStudentAnswer({
          data: { assignmentId, questionId },
        }),
        getStudentNextQuestion({
          data: { assignmentId, questionId },
        }),
        getStudentPreviousQuestion({
          data: { assignmentId, questionId },
        }),
        getSubmission({
          data: { assignmentId },
        }),
      ]);

      const { courseId, question } = questionResult;
      if (!question) throw notFound();

      // Read-only once the submission is marked submitted (submitted_at set).
      const submission = submissionResult.submission;
      const isSubmitted =
        submission !== null && submission.submittedAt !== null;

      // Issue #101: the submit option depends on every question of the
      // assignment, not only on the question on screen. getSubmission
      // returns one row per question of the assignment, each flagged
      // answered, so the option shows when the submission is in
      // progress and no row is unanswered. A submission row must exist
      // (the submit guard on the overview page is the same), and an
      // assignment with no questions is never submittable here.
      const canSubmit =
        submission !== null &&
        submission.submittedAt === null &&
        submissionResult.questions.length > 0 &&
        submissionResult.questions.every((q) => q.answered);

      return {
        question,
        nextQuestion,
        prevQuestion,
        currentAnswer,
        isSubmitted,
        courseId,
        canSubmit,
      };
    },
  },
  component: SubmitAnswerComponent,
  remountDeps: ({ params }) => [params.questionId],
  pendingComponent: QuestionPending,
  pendingMs: 0,
  pendingMinMs: 300,
});

function QuestionPending() {
  return (
    <>
      <div className="grid grid-cols-3 items-center w-full px-8 py-8">
        <div className="justify-self-start">
          <div className="skeleton h-8 w-full" />
        </div>

        <div className="justify-self-center"></div>

        <div className="justify-self-end">
          <div className="skeleton h-8 w-3/4" />
        </div>
      </div>
      <div
        className="flex w-full items-center justify-center"
        aria-busy="true"
        aria-label="Loading question"
      >
        <div className="w-full max-w-md space-y-4">
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-10 w-32" />
        </div>
      </div>
    </>
  );
}

function SubmitAnswerComponent() {
  const {
    question,
    nextQuestion,
    prevQuestion,
    currentAnswer,
    isSubmitted,
    courseId,
    canSubmit,
  } = Route.useLoaderData();
  const { assignmentId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  // The issue #101 submit option: open when the student clicked the
  // question page's "Submit assignment" button.
  const [submitOpen, setSubmitOpen] = useState(false);
  // The auto-check result (issue #95): non-null while the score modal
  // shows, after the student submitted a check_on_submit assignment.
  const [score, setScore] = useState<{
    score: number;
    total: number;
  } | null>(null);

  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof submitAnswerFormSchema>;
  }) => {
    try {
      await upsertAnswer({ data: value });
      if (nextQuestion) {
        navigate({
          to: "/student/assignments/$assignmentId/questions/$questionId",
          params: {
            assignmentId: assignmentId,
            questionId: String(nextQuestion.id),
          },
        });
      } else {
        form.reset();
        router.invalidate();
      }
    } catch (err) {
      console.error("Error in submitting answer", err);
      throw new Error("Could not submit the answer", { cause: err });
    }
  };

  const form = useForm({
    defaultValues: {
      assignmentId: Number(assignmentId),
      questionId: question.id,
      answer: currentAnswer ? currentAnswer.answer : "",
    },
    validators: {
      onSubmit: submitAnswerFormSchema,
    },
    onSubmit: handleSubmit,
  });

  return (
    <div>
      <div className="grid grid-cols-3 items-center w-full px-8 py-8">
        <div className="justify-self-start">
          {prevQuestion && (
            <Link
              to="/student/assignments/$assignmentId/questions/$questionId"
              params={{ assignmentId, questionId: String(prevQuestion.id) }}
              className="btn btn-secondary"
            >
              Previous
            </Link>
          )}
        </div>

        <div className="justify-self-center">Q{question.position + 1}</div>

        <div className="justify-self-end">
          {nextQuestion && (
            <Link
              to="/student/assignments/$assignmentId/questions/$questionId"
              params={{ assignmentId, questionId: String(nextQuestion.id) }}
              className="btn btn-secondary"
            >
              Next
            </Link>
          )}
        </div>
      </div>
      {/* Issue #101: the submit option, at the top of the answer form.
          It renders only while the submission is in progress and every
          question of the assignment has a saved answer (canSubmit), so
          it sits above the form instead of inside it. */}
      {canSubmit && (
        <div className="flex w-full items-center justify-center">
          {/* Review on PR #102: the option renders as a card, in the
              style of the AnswerCard, with space below it so it sits
              apart from the question form. */}
          <div className="card mt-4 mb-8 w-full max-w-md border-2 border-base-300 bg-base-100 shadow-md">
            <div className="card-body items-center gap-y-2 text-center">
              <p>
                All the questions in this assignment have been answered. Do you
                want to submit the assignment?
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSubmitOpen(true)}
              >
                Submit assignment
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex w-full items-center justify-center">
        {isSubmitted ? (
          <div className="mt-4 w-full max-w-md space-y-4">
            <h3 className="text-3xl">{question.questionText}</h3>
            <p>
              {currentAnswer
                ? `Your answer: ${currentAnswer.answer}`
                : "No answer submitted"}
            </p>
            <Link
              to="/student/assignments/$assignmentId"
              params={{ assignmentId: String(question.assignmentId) }}
              className="link text-sm"
            >
              Back to assignment
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="mt-4">
              <h3 className="text-3xl">{question.questionText}</h3>
            </div>
            <form.Subscribe selector={(s) => s.errors}>
              {(errors) => {
                const messages = errors.flatMap((byField) =>
                  Object.values(byField)
                    .flat()
                    .map((issue) => issue.message),
                );
                return messages.length > 0 ? (
                  <div className="alert alert-error">
                    {messages.map((msg, i) => (
                      <p key={i}>{msg}</p>
                    ))}
                  </div>
                ) : null;
              }}
            </form.Subscribe>
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(error) =>
                typeof error === "string" ? (
                  <FormErrorAlert errorMsg={error} />
                ) : null
              }
            </form.Subscribe>
            <form.Field name="answer">
              {(field) => <TextField field={field} label="Answer" />}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton
                  label="Submit answer"
                  submittingLabel="Answering"
                  isSubmitting={isSubmitting}
                />
              )}
            </form.Subscribe>
            <Link
              to="/student/assignments/$assignmentId"
              params={{ assignmentId: String(question.assignmentId) }}
              className="link ml-8 text-sm"
            >
              Back to assignment
            </Link>
          </form>
        )}
      </div>
      {canSubmit && (
        <ConfirmModal
          open={submitOpen}
          message="Submit this assignment?"
          onConfirm={async () => {
            // The same submitAssignment flow as the overview page
            // (issues #95 and #101): a checked assignment shows the
            // score modal, a stored-off one reloads this route so the
            // submitted state (submitted_at set) is reflected and the
            // option disappears. The ConfirmModal keeps the page under
            // its top layer (with a spinner on Okay) until this
            // resolves, so the submit action cannot be double-fired.
            const result = await submitAssignment({
              data: { assignmentId: Number(assignmentId) },
            });
            if (result.checked) {
              setScore({ score: result.score, total: result.total });
            } else {
              await router.invalidate();
            }
          }}
          onClose={() => setSubmitOpen(false)}
        />
      )}
      {score && (
        <ScoreModal
          score={score.score}
          total={score.total}
          onClose={() => {
            // Closing the modal returns the student to the course
            // page — the same route the overview page redirects to
            // after submission. The navigation unmounts this route
            // (and the modal with it).
            setScore(null);
            void router.navigate({
              to: "/student/courses/$courseId",
              params: { courseId: String(courseId) },
            });
          }}
        />
      )}
    </div>
  );
}
