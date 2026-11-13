import FormErrorAlert from "@/components/form-error-alert";
import Breadcrumbs from "@/components/common/breadcrumbs";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { lessonFormSchema } from "@/schemas/course-schema";
import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { createLesson } from "@/server/lessons/create-lesson";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/courses/$courseId/lessons/new",
)({
  loader: async ({ params }) => {
    // Duplicated author guard: only the course author may open the new
    // lesson page. A non-author is thrown to the router's
    // defaultNotFoundComponent.
    const courseId = Number(params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();
    const course = await getCourseByIdAndAuthor({ data: { courseId } });
    if (!course) throw notFound();
    return { course };
  },
  component: NewLessonComponent,
});

function NewLessonComponent() {
  const { course } = Route.useLoaderData();
  const navigate = useNavigate();
  const failMessage = "Could not create the lesson. Please try again.";

  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof lessonFormSchema>;
  }) => {
    let created;
    try {
      created = await createLesson({ data: value });
    } catch (err) {
      console.error(`Failed to create lesson for course ${course.id}`, err);
      form.setErrorMap({
        onSubmit: {
          form: failMessage,
          fields: {},
        },
      });
      return;
    }

    if (!created) {
      form.setErrorMap({
        onSubmit: {
          form: failMessage,
          fields: {},
        },
      });
      return;
    }
    await navigate({
      to: "/courses/$courseId",
      params: { courseId: String(course.id) },
      search: { tab: "lessons" },
    });
  };

  const form = useForm({
    defaultValues: {
      title: "",
      content: "",
      courseId: course.id,
    },
    validators: {
      onSubmit: lessonFormSchema,
      onBlur: lessonFormSchema,
    },
    onSubmit: handleSubmit,
  });

  return (
    <div>
      {/* Breadcrumb: course title (link back to the course) > New lesson
          (the current page, text only). */}
      <Breadcrumbs
        items={[
          <Link
            key="course"
            to="/courses/$courseId"
            params={{ courseId: String(course.id) }}
          >
            {course.title}
          </Link>,
          <span key="new-lesson">New lesson</span>,
        ]}
      />
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
        <form.Field name="content">
          {(field) => <TextField field={field} label="Content" multiline />}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SubmitButton
              label="Save Lesson"
              submittingLabel="Saving"
              isSubmitting={isSubmitting}
            />
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
