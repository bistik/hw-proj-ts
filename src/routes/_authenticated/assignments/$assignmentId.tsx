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
          {(field) => {
            const { errors, isTouched } = field.state.meta;
            return (
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Question</legend>
                <textarea
                  onBlur={(e) => field.handleBlur()}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="textarea"
                  value={field.state.value}
                />

                {errors.length > 0 && isTouched && (
                  <p className="label text-error">{errors[0]?.message}</p>
                )}
              </fieldset>
            );
          }}
        </form.Field>
        <form.Field name="answer">
          {(field) => {
            const { errors, isTouched } = field.state.meta;
            return (
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Answer</legend>
                <textarea
                  onBlur={(e) => field.handleBlur()}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="textarea"
                  value={field.state.value}
                />

                {errors.length > 0 && isTouched && (
                  <p className="label text-error">{errors[0]?.message}</p>
                )}
              </fieldset>
            );
          }}
        </form.Field>
        <button type="submit" className="btn">
          Add question
        </button>
      </form>
    </div>
  );
}
