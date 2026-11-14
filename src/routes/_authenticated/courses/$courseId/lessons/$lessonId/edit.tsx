import FormErrorAlert from "@/components/form-error-alert";
import Breadcrumbs from "@/components/common/breadcrumbs";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { lessonUpdateFormSchema } from "@/schemas/course-schema";
import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { getLesson } from "@/server/lessons/get-lesson";
import { updateLesson } from "@/server/lessons/update-lesson";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/courses/$courseId/lessons/$lessonId/edit",
)({
  loader: async ({ params }) => {
    const courseId = Number(params.courseId);
    const lessonId = Number(params.lessonId);
    if (
      !Number.isInteger(courseId) ||
      courseId <= 0 ||
      !Number.isInteger(lessonId) ||
      lessonId <= 0
    ) {
      throw notFound();
    }
    // getLesson only returns a lesson of a course authored by the signed-in
    // user, so an unknown id and a non-author both fail here (the router
    // throws them to defaultNotFoundComponent).
    const lesson = await getLesson({ data: lessonId });
    if (!lesson || lesson.courseId !== courseId) throw notFound();
    const course = await getCourseByIdAndAuthor({ data: { courseId } });
    if (!course) throw notFound();
    return { lesson, course };
  },
  component: EditLessonComponent,
});

function EditLessonComponent() {
  const { lesson, course } = Route.useLoaderData();
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
      to: "/courses/$courseId",
      params: { courseId: String(course.id) },
      search: { tab: "lessons" },
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
    <div>
      {/* Breadcrumb: course title (link back to the course) > lesson title
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
          <span key="lesson">{lesson.title}</span>,
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
          {(field) => (
            <TextField field={field} label="Content" multiline rows={10} />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SubmitButton
              label="Update lesson"
              submittingLabel="Updating"
              isSubmitting={isSubmitting}
            />
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
