import { TextField } from "@/components/text-field";
import { lessonUpdateFormSchema } from "@/schemas/course-schema";
import { getLesson } from "@/server/lessons/get-lesson";
import { updateLesson } from "@/server/lessons/update-lesson";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId/edit")({
  loader: async ({ params }) => {
    const lessonId = Number(params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) throw notFound();
    const lesson = await getLesson({ data: lessonId });
    if (!lesson) throw notFound();
    return { lesson };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { lesson } = Route.useLoaderData();
  const navigate = useNavigate();
  const failMessage = "Could not update the lesson. Please try again.";
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof lessonUpdateFormSchema>;
  }) => {
    let updated;
    try {
      updated = await updateLesson({ data: value });
    } catch (err) {
      console.error(`Failed to update lesson ${lesson.id}`, err);
      form.setErrorMap({
        onSubmit: {
          form: failMessage,
          fields: {},
        },
      });
      return;
    }

    if (!updated) {
      form.setErrorMap({
        onSubmit: {
          form: failMessage,
          fields: {},
        },
      });
      return;
    }
    await navigate({
      to: "/lessons/$lessonId",
      params: { lessonId: String(updated.id) },
    });
  };

  const form = useForm({
    defaultValues: {
      lessonId: lesson.id,
      title: lesson.title,
      content: lesson.content,
    },
    validators: {
      onSubmit: lessonUpdateFormSchema,
      onBlur: lessonUpdateFormSchema,
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
      <form.Field name="title">
        {(field) => <TextField field={field} label="Title" />}
      </form.Field>
      <form.Field name="content">
        {(field) => (
          <TextField field={field} label="Content" multiline rows={10} />
        )}
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
                <span className="loading loading-spinner"></span>Updating
              </>
            ) : (
              "Update lesson"
            )}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
