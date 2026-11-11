import { getSubmissionForReview } from "@/server/assignments/submissions/get-submission";
import { gradeSubmissionAnswer } from "@/server/assignments/submissions/answers/update-answer";
import AnswerCard from "@/components/submissions/answer-card";
import SubmissionSummaryCard from "@/components/submissions/summary-card";
import { Link, createFileRoute, notFound, useRouter } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/courses/$courseId/assignments/$assignmentId/submissions/$submissionId",
)({
  loader: async ({ params }) => {
    const courseId = Number(params.courseId);
    const assignmentId = Number(params.assignmentId);
    const submissionId = Number(params.submissionId);
    if (
      !Number.isInteger(courseId) ||
      courseId <= 0 ||
      !Number.isInteger(assignmentId) ||
      assignmentId <= 0 ||
      !Number.isInteger(submissionId) ||
      submissionId <= 0
    ) {
      throw notFound();
    }
    const review = await getSubmissionForReview({
      data: { courseId, assignmentId, submissionId },
    });
    // The server fn returns null when the submission does not exist: show
    // a 404. Ownership and course/assignment mismatches throw and render
    // the error page instead.
    if (review === null) throw notFound();
    return { courseId, submissionId, review };
  },
  component: SubmissionReviewComponent,
});

function SubmissionReviewComponent() {
  const { courseId, submissionId, review } = Route.useLoaderData();
  const router = useRouter();

  const grade = async (questionId: number, isCorrect: boolean) => {
    await gradeSubmissionAnswer({
      data: {
        courseId,
        submissionId,
        questionId,
        isCorrect,
      },
    });
    await router.invalidate();
  };

  return (
    <div className="flex w-full justify-center min-h-64">
      <div className="my-4 w-full">
        {/* Breadcrumb: course title > All course submissions, matching the
            card-title link on the course detail Submissions tab. */}
        <div className="text-sm breadcrumbs mb-8">
          <ul>
            <li>
              <Link
                to="/courses/$courseId"
                params={{ courseId: String(courseId) }}
              >
                {review.courseTitle}
              </Link>
            </li>
            <li>
              <Link
                to="/courses/$courseId"
                params={{ courseId: String(courseId) }}
                search={{ tab: "submissions" }}
              >
                All course submissions
              </Link>
            </li>
          </ul>
        </div>

        <SubmissionSummaryCard
          assigneeEmail={review.assigneeEmail}
          assigneeName={review.assigneeName}
          startedAt={review.startedAt}
          correctCount={review.correctCount}
          total={review.total}
        />

        <div className="flex flex-col gap-y-8 mt-8">
          {review.questions.map((question) => (
            <AnswerCard
              key={question.id}
              position={question.position}
              questionText={question.questionText}
              studentAnswer={question.studentAnswer}
              correctAnswer={question.correctAnswer}
              isCorrect={question.isCorrect}
              gradable={review.submittedAt !== null}
              onGrade={(isCorrect) => grade(question.id, isCorrect)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
