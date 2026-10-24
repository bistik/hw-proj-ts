import { TextField } from "@/components/text-field";
import { questionFormSchema } from "@/schemas/course-schema";
import { getAssignmentById } from "@/server/assignments/get-assignment";
import { createQuestion } from "@/server/questions/create-question";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/assignments/$assignmentId",
)({
  loader: async ({ params }) => {
    const assignment = await getAssignmentById({
      data: Number(params.assignmentId),
    });
    if (!assignment) {
      throw notFound();
    }
    return { assignment };
  },
  component: RouteComponent,
});

type QuestionInput = z.infer<typeof questionFormSchema>;

function RouteComponent() {
  const { assignment } = Route.useLoaderData();
  const handleSubmit = async function ({ value }: { value: QuestionInput }) {
    const result = await createQuestion({ data: value });
    if (result) {
      console.log("Question successfully added");
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
      Hello "/_authenticated/assignments/$assignmentId"!
      <h2>Assignment title: {assignment.title}</h2>
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
        <button type="submit" className="btn">
          Add question
        </button>
      </form>
    </div>
  );
}
