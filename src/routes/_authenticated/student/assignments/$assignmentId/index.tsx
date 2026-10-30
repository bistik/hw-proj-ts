import { getSubmission } from "@/server/assignments/submissions/get-submission";
import { getStudentQuestions } from "@/server/questions/get-questions";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

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
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="alert alert-info">No questions on this assignment</div>
    );
  }
}
