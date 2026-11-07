import { getSubmission } from "@/server/assignments/submissions/get-submission";
import { setSubmissionToNow } from "@/server/assignments/submissions/mutate-submission";
import { getStudentQuestions } from "@/server/questions/get-questions";
import ConfirmModal from "@/components/confirm-modal";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute(
  "/_authenticated/student/assignments/$assignmentId/",
)({
  loader: async ({ params }) => {
    const assignmentId = Number(params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) throw notFound();
    const questions = await getStudentQuestions({ data: { assignmentId } });
    const assignmentSubmission = await getSubmission({
      data: { assignmentId },
    });
    return { questions, assignmentSubmission };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { questions, assignmentSubmission } = Route.useLoaderData();
  const { assignmentId } = Route.useParams();
  const [submitOpen, setSubmitOpen] = useState(false);
  const router = useRouter();

  // Submittable only when the student already started (a submission record
  // exists) and has not submitted yet (submitted_at is null).
  const submissionRecord = assignmentSubmission.submission;
  const canSubmit =
    submissionRecord !== null && submissionRecord.submittedAt === null;

  if (questions && questions.length > 0) {
    return (
      <div className="flex w-full justify-center min-h-64">
        <div className="my-4">
          <ul className="steps">
            {questions.map((question) => {
              const answered = assignmentSubmission.questions.find(
                (q) => q.id === question.id,
              )?.answered;
              return (
                <li
                  key={question.id}
                  data-content={answered ? "●" : ""}
                  className={`step ${answered ? "step-accent" : "step-neutral"}`}
                >
                  <Link
                    to="/student/assignments/$assignmentId/questions/$questionId"
                    params={{
                      assignmentId: String(question.assignmentId),
                      questionId: String(question.id),
                    }}
                    className="link hover:font-bold hover:text-primary"
                  >
                    Q{question.position + 1}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col items-center py-4 gap-y-4">
            <p>
              {assignmentSubmission.questions.filter((q) => q.answered).length}{" "}
              of {questions.length} questions have been answered
            </p>
            <div>
              <div className="flex items-center justify-center gap-x-2">
                <Link
                  to="/student/assignments/$assignmentId/questions/$questionId"
                  params={{
                    assignmentId: assignmentId,
                    questionId: String(questions[0].id),
                  }}
                  className="btn btn-primary"
                >
                  Go to question #1
                </Link>
                {/* TODO: wire up the actual assignment submission action. */}
                {canSubmit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setSubmitOpen(true)}
                  >
                    Submit assignment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {canSubmit && (
          <ConfirmModal
            open={submitOpen}
            message="Submit this assignment?"
            onConfirm={async () => {
              // Mark the submission as submitted, then reload the route so
              // the freshly submitted state (submitted_at set) is reflected
              // and the button disappears. The ConfirmModal keeps the page
              // under its top layer (with a spinner on Okay) until this
              // resolves, so the submit action cannot be double-fired.
              await setSubmissionToNow({
                data: { assignmentId: Number(assignmentId) },
              });
              await router.invalidate();
            }}
            onClose={() => setSubmitOpen(false)}
          />
        )}
      </div>
    );
  } else {
    return (
      <div className="alert alert-info">No questions on this assignment</div>
    );
  }
}
