import { getSubmission } from "@/server/assignments/submissions/get-submission";
import { submitAssignment } from "@/server/assignments/submissions/mutate-submission";
import { getStudentQuestions } from "@/server/questions/get-questions";
import ConfirmModal from "@/components/confirm-modal";
import ScoreModal from "@/components/score-modal";
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
    const { courseId, questions } = await getStudentQuestions({
      data: { assignmentId },
    });
    const assignmentSubmission = await getSubmission({
      data: { assignmentId },
    });
    return { questions, assignmentSubmission, courseId };
  },
  component: StudentAssignmentDetailComponent,
});

function StudentAssignmentDetailComponent() {
  const { questions, assignmentSubmission, courseId } = Route.useLoaderData();
  const { assignmentId } = Route.useParams();
  const [submitOpen, setSubmitOpen] = useState(false);
  // The auto-check result of issue #95: non-null while the score modal
  // shows, after the student submitted a check_on_submit assignment.
  const [score, setScore] = useState<{
    score: number;
    total: number;
  } | null>(null);
  const router = useRouter();

  // Submittable only when the student already started (a submission record
  // exists) and has not submitted yet (submitted_at is null).
  const submissionRecord = assignmentSubmission.submission;
  const canSubmit =
    submissionRecord !== null && submissionRecord.submittedAt === null;

  return (
    <div className="flex w-full justify-center min-h-64">
      <div className="my-4">
        <div className="mb-2">
          <Link
            to="/student/courses/$courseId"
            params={{ courseId: String(courseId) }}
            className="link hover:font-bold hover:text-primary"
          >
            Back to course
          </Link>
        </div>
        {questions && questions.length > 0 ? (
          <>
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
                {
                  assignmentSubmission.questions.filter((q) => q.answered)
                    .length
                }{" "}
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
          </>
        ) : (
          <div className="alert alert-info">
            No questions on this assignment
          </div>
        )}
      </div>
      {canSubmit && (
        <ConfirmModal
          open={submitOpen}
          message="Submit this assignment?"
          onConfirm={async () => {
            // Submit, then react to the auto-check result (issue #95):
            // a checked assignment shows the score modal, a stored-off
            // one keeps the plain flow. The ConfirmModal keeps the page
            // under its top layer (with a spinner on Okay) until this
            // resolves, so the submit action cannot be double-fired.
            const result = await submitAssignment({
              data: { assignmentId: Number(assignmentId) },
            });
            if (result.checked) {
              setScore({ score: result.score, total: result.total });
            } else {
              // Reload the route so the freshly submitted state
              // (submitted_at set) is reflected and the button
              // disappears.
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
            // page; the navigation unmounts this route (and the modal
            // with it).
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
