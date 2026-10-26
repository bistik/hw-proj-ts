import { TextField } from "@/components/text-field";
import { questionUpdateFormSchema } from "@/schemas/course-schema";
import { getQuestion } from "@/server/questions/get-questions";
import { updateQuestion } from "@/server/questions/update-question";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/assignments/$assignmentId/questions/$questionId/edit",
)({
  loader: async ({ params }) => {
    const questionId = Number(params.questionId);
    const assignmentId = Number(params.assignmentId);
    if (!Number.isInteger(assignmentId) || !Number.isInteger(questionId)) {
      throw notFound();
    }
    const question = await getQuestion({ data: Number(params.questionId) });
    if (!question || question.assignmentId !== assignmentId) throw notFound();
    return { question };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { question } = Route.useLoaderData();
  const { assignmentId } = Route.useParams();
  const navigate = useNavigate();
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof questionUpdateFormSchema>;
  }) => {
    const result = await updateQuestion({ data: value });
    if (result) {
      navigate({
        to: "/assignments/$assignmentId",
        params: { assignmentId: assignmentId },
      });
    }
  };
  const form = useForm({
    defaultValues: {
      questionId: question.id,
      questionText: question.questionText,
      answer: question.answer,
    },
    validators: {
      onSubmit: questionUpdateFormSchema,
      onBlur: questionUpdateFormSchema,
    },
    onSubmit: handleSubmit,
  });
  return (
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
      <button type="submit" className="btn btn-primary">
        Update question
      </button>
    </form>
  );
}
