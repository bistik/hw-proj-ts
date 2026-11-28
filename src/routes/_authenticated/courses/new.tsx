import FormErrorAlert from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
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
      // Whole-schema validation only on submit (issue #64): the
      // field-scoped onBlur validators on the form.Field elements
      // below keep a blur scoped to the blurred field.
      onSubmit: courseFormSchema,
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
          typeof error === "string" ? <FormErrorAlert errorMsg={error} /> : null
        }
      </form.Subscribe>
      <form.Field
        name="title"
        validators={{ onBlur: courseFormSchema.shape.title }}
      >
        {(field) => <TextField field={field} label="Title" />}
      </form.Field>
      <form.Field
        name="description"
        validators={{ onBlur: courseFormSchema.shape.description }}
      >
        {(field) => (
          <TextField field={field} label="Description" multiline rows={5} />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <SubmitButton label="Add course" submittingLabel="Adding" isSubmitting={isSubmitting} />
        )}
      </form.Subscribe>
    </form>
  );
}
