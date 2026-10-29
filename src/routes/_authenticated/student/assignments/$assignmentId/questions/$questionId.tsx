import { TextField } from "@/components/text-field";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { upsertAnswer } from "@/server/assignments/submissions/answers/create-answer";
import { getStudentAnswer } from "@/server/assignments/submissions/answers/get-answer";
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
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/student/assignments/$assignmentId/questions/$questionId",
)({
  loader: async ({ params }) => {
    const assignmentId = Number(params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) throw notFound();

    const questionId = Number(params.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) throw notFound();

    const [question, currentAnswer, nextQuestion, prevQuestion] =
      await Promise.all([
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
      ]);

    if (!question) throw notFound();

    return { question, nextQuestion, prevQuestion, currentAnswer };
  },
  component: RouteComponent,
  remountDeps: ({ params }) => [params.questionId],
  pendingComponent: QuestionPending,
  pendingMs: 0,
  pendingMinMs: 300,
});

function QuestionPending() {
  return (
    <div
      className="flex w-full items-center justify-center"
      aria-busy="true"
      aria-label="Loading question"
    >
      <div className="w-full max-w-md space-y-4">
        <div className="skeleton h-8 w-3/4" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-10 w-32" />
      </div>
    </div>
  );
}

function RouteComponent() {
  const { question, nextQuestion, prevQuestion, currentAnswer } =
    Route.useLoaderData();
  const { assignmentId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

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

        {/* Middle Div */}
        <div className="justify-self-center">Center</div>

        {/* Rightmost Div */}
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
      <div className="flex w-full items-center justify-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="mt-4">
            <h3 className="text-2xl">{question.questionText}</h3>
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
                <div role="alert" className="alert alert-error">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="h-6 w-6 shrink-0 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span>{error}</span>
                </div>
              ) : null
            }
          </form.Subscribe>
          <form.Field name="answer">
            {(field) => <TextField field={field} label="Answer" />}
          </form.Field>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="submit"
                className="btn btn-primary my-4"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner"></span>Answering
                  </>
                ) : (
                  "Submit answer"
                )}
              </button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  );
}
