import { courseFormSchema, defaultCourse } from "@/schemas/course-schema";
import { createCourse } from "@/server/courses/create-course";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/courses/new")({
  component: RouteComponent,
});

function RouteComponent() {
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof courseFormSchema>;
  }) => {
    const result = await createCourse({ data: value });
    if (result) {
      console.log("successful create course");
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
      <button className="btn bg-primary mt-2" type="submit">
        Save course
      </button>
    </form>
  );
}
