import { courseFormSchema, defaultCourse } from "@/schemas/course-schema";
import { createCourse } from "@/server/courses/mutate-course";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/courses/new")({
  component: NewCourseComponent,
});

function NewCourseComponent() {
  const navigate = useNavigate();
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof courseFormSchema>;
  }) => {
    try {
      const result = await createCourse({ data: value });
      if (result)
        navigate({
          to: "/courses",
        });
    } catch (err) {
      form.setErrorMap({
        onSubmit: { form: "Could not create a course.", fields: {} },
      });
    }
  };
  const form = useForm({
    defaultValues: defaultCourse,
    onSubmit: handleSubmit,
    validators: {
      onSubmit: courseFormSchema,
      onBlur: courseFormSchema,
    },
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
        {(field) => {
          const { errors, isTouched } = field.state.meta;
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Title</legend>
              <input
                value={field.state.value}
                onBlur={(e) => field.handleBlur()}
                onChange={(e) => field.handleChange(e.target.value)}
                type="text"
                className="input"
                placeholder="Title"
              />
              {errors.length > 0 && isTouched && (
                <p className="label text-error">{errors[0]?.message}</p>
              )}
            </fieldset>
          );
        }}
      </form.Field>
      <form.Field name="description">
        {(field) => {
          const { errors, isTouched } = field.state.meta;
          return (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Description</legend>
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
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <button
            type="submit"
            className="btn btn-primary my-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner"></span>Adding
              </>
            ) : (
              "Add course"
            )}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
