import { getSubmissionForReview } from "@/server/assignments/submissions/get-submission";
import { gradeSubmissionAnswer } from "@/server/assignments/submissions/answers/update-answer";
import { completeSubmission } from "@/server/assignments/submissions/complete-submission";
import AnswerCard from "@/components/submissions/answer-card";
import SubmissionSummaryCard from "@/components/submissions/summary-card";
import Breadcrumbs from "@/components/common/breadcrumbs";
import FormErrorAlert from "@/components/form-error-alert";
import { Link, createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";

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

  // The grading in flight (issue #93), or null while none runs. The state
  // lives here, one level above the cards, and each AnswerCard receives
  // the part scoped to itself. One object holds the question and the
  // grade together, because they always change at the same time.
  const [grading, setGrading] = useState<{
    questionId: number;
    isCorrect: boolean;
  } | null>(null);
  // The error message from the last grading, or null when it worked. The
  // route shows it through FormErrorAlert, like the outline move error.
  const [gradeError, setGradeError] = useState<string | null>(null);

  const grade = async (questionId: number, isCorrect: boolean) => {
    setGrading({ questionId, isCorrect });
    // A new grading clears the error from the previous one, so the alert
    // always shows the outcome of the latest attempt.
    setGradeError(null);
    try {
      await gradeSubmissionAnswer({
        data: {
          courseId,
          submissionId,
          questionId,
          isCorrect,
        },
      });
      await router.invalidate();
    } catch (err) {
      console.error(`Error grading the answer of question ${questionId}`, err);
      setGradeError("Could not grade the answer. Please try again.");
    } finally {
      setGrading(null);
    }
  };

  // Grading (and completing) is offered only while the submission is
  // submitted and not yet completed: completing closes the review.
  const open = review.submittedAt !== null && review.completedAt === null;

  const complete = async () => {
    await completeSubmission({
      data: {
        courseId,
        submissionId,
      },
    });
    await router.invalidate();
  };

  return (
    <div className="flex w-full justify-center min-h-64">
      <div className="my-4 w-full">
        {/* Breadcrumb: course title > All course submissions, matching the
            card-title link on the course detail Submissions tab. */}
        <Breadcrumbs
          items={[
            <Link
              key="course"
              to="/courses/$courseId"
              params={{ courseId: String(courseId) }}
            >
              {review.courseTitle}
            </Link>,
            <Link
              key="submissions"
              to="/courses/$courseId"
              params={{ courseId: String(courseId) }}
              search={{ tab: "submissions" }}
            >
              All course submissions
            </Link>,
          ]}
        />

        <SubmissionSummaryCard
          assigneeEmail={review.assigneeEmail}
          assigneeName={review.assigneeName}
          startedAt={review.startedAt}
          submittedAt={review.submittedAt}
          completedAt={review.completedAt}
          correctCount={review.correctCount}
          total={review.total}
          canComplete={open}
          onComplete={complete}
        />

        <div className="flex flex-col gap-y-8 mt-8">
          {gradeError !== null && <FormErrorAlert errorMsg={gradeError} />}
          {review.questions.map((question) => (
            <AnswerCard
              key={question.id}
              position={question.position}
              questionText={question.questionText}
              studentAnswer={question.studentAnswer}
              correctAnswer={question.correctAnswer}
              isCorrect={question.isCorrect}
              gradable={open}
              grading={
                grading !== null && grading.questionId === question.id
                  ? { isCorrect: grading.isCorrect }
                  : null
              }
              onGrade={(isCorrect) => grade(question.id, isCorrect)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
