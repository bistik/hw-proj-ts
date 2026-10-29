import { TextField } from "@/components/text-field";
import { submitAnswerFormSchema } from "@/schemas/course-schema";
import { upsertAnswer } from "@/server/assignments/submissions/answers/create-answer";
import { getSubmission } from "@/server/assignments/submissions/get-submission";
import { getStudentQuestions } from "@/server/questions/get-questions";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import z from "zod";

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
  const { questions } = Route.useLoaderData();
  const { assignmentId } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof submitAnswerFormSchema>;
  }) => {
    try {
      await upsertAnswer({ data: value });
      if (questions[1]?.id) {
        navigate({
          to: "/student/assignments/$assignmentId/questions/$questionId",
          params: {
            assignmentId: assignmentId,
            questionId: String(questions[1].id),
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
      questionId: questions[0]?.id ?? 0,
      answer: "",
    },
    validators: {
      onSubmit: submitAnswerFormSchema,
    },
    onSubmit: handleSubmit,
    onSubmitInvalid: ({ formApi }) => {
      console.log("invalid:", formApi.state.errorMap);
      console.log("all errors:", formApi.getAllErrors());
    },
  });

  if (questions && questions.length > 0) {
    return (
      <>
        <div className="flex w-full items-center justify-center">
          <ul className="timeline">
            {questions.map((question) => (
              <li key={question.id}>
                <hr />
                <div className="timeline-start timeline-box">
                  {question.questionText}
                </div>
                <div className="timeline-middle">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <hr />
              </li>
            ))}
          </ul>
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
              <h3 className="text-2xl">{questions[0].questionText}</h3>
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
      </>
    );
  } else {
    return (
      <div className="alert alert-info">No questions on this assignment</div>
    );
  }
}
