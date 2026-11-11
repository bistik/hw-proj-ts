import FormErrorAlert from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { courseUpdateFormSchema } from "@/schemas/course-schema";
import { updateCourse } from "@/server/courses/mutate-course";
import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/courses/$courseId/edit")({
  loader: async ({ params }) => {
    // Duplicated author guard: only the course author may open the edit page.
    // A non-author is thrown to the router's defaultNotFoundComponent.
    const courseId = Number(params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();
    const course = await getCourseByIdAndAuthor({ data: { courseId } });
    if (!course) throw notFound();
    return { course };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { course } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();

  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof courseUpdateFormSchema>;
  }) => {
    const result = await updateCourse({ data: value });
    if (!result) {
      form.setErrorMap({
        onSubmit: {
          form: "Could not update the course. Please try again.",
          fields: {},
        },
      });
      return;
    }
    await router.invalidate();
    await navigate({
      to: "/courses/$courseId",
      params: { courseId: String(course.id) },
    });
  };

  const form = useForm({
    defaultValues: {
      courseId: course.id,
      title: course.title,
      description: course.description ?? "",
    },
    validators: {
      onSubmit: courseUpdateFormSchema,
      onBlur: courseUpdateFormSchema,
    },
    onSubmit: handleSubmit,
  });

  return (
    <div>
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
              <FormErrorAlert errorMsg={error} />
            ) : null
          }
        </form.Subscribe>
        <form.Field name="title">
          {(field) => <TextField field={field} label="Title" />}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <TextField field={field} label="Description" multiline rows={5} />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <SubmitButton label="Update course" submittingLabel="Updating" isSubmitting={isSubmitting} />
        )}
      </form.Subscribe>
      </form>
    </div>
  );
}
