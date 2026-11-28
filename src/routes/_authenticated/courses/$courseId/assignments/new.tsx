import FormErrorAlert from "@/components/form-error-alert";
import Breadcrumbs from "@/components/common/breadcrumbs";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { assignmentFormSchema } from "@/schemas/course-schema";
import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import { createAssignment } from "@/server/assignments/mutate-assignment";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute(
  "/_authenticated/courses/$courseId/assignments/new",
)({
  loader: async ({ params }) => {
    // Duplicated author guard: only the course author may open the new
    // assignment page. A non-author is thrown to the router's
    // defaultNotFoundComponent.
    const courseId = Number(params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();
    const course = await getCourseByIdAndAuthor({ data: { courseId } });
    if (!course) throw notFound();
    return { course };
  },
  component: NewAssignmentComponent,
});

// Issue #84: the points dropdown offers exactly 1 to 10, nothing below
// 1, nothing above 10, no gaps, in order.
const pointsOptions = Array.from({ length: 10 }, (_, i) => i + 1);

function NewAssignmentComponent() {
  const { course } = Route.useLoaderData();
  const navigate = useNavigate();
  const failMessage = "Could not create the assignment. Please try again.";

  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof assignmentFormSchema>;
  }) => {
    let created;
    try {
      created = await createAssignment({ data: value });
    } catch (err) {
      console.error(`Failed to create assignment for course ${course.id}`, err);
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
      search: { tab: "assignments" },
    });
  };

  const form = useForm({
    defaultValues: {
      title: "",
      example: "",
      courseId: course.id,
      points: 1,
      // Issue #86: the checkbox is off/unchecked by default.
      checkOnSubmit: false,
    },
    validators: {
      // Whole-schema validation only on submit (issue #64): the
      // field-scoped onBlur validators on the form.Field elements
      // below keep a blur scoped to the blurred field.
      onSubmit: assignmentFormSchema,
    },
    onSubmit: handleSubmit,
  });

  return (
    <div>
      {/* Breadcrumb: course title (link back to the course) > New assignment
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
          <span key="new-assignment">New assignment</span>,
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
        <form.Field
          name="title"
          validators={{ onBlur: assignmentFormSchema.shape.title }}
        >
          {(field) => <TextField field={field} label="Title" />}
        </form.Field>
        <form.Field
          name="example"
          validators={{ onBlur: assignmentFormSchema.shape.example }}
        >
          {(field) => (
            <TextField field={field} label="Example" multiline rows={8} />
          )}
        </form.Field>
        <form.Field
          name="points"
          validators={{ onBlur: assignmentFormSchema.shape.points }}
        >
          {(field) => (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Points</legend>
              <select
                className="select"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              >
                {pointsOptions.map((points) => (
                  <option key={points} value={points}>
                    {points}
                  </option>
                ))}
              </select>
            </fieldset>
          )}
        </form.Field>
        {/* Issue #86: the "Check answers on submit" checkbox, same
            fieldset/legend pattern as the Points field. The form always
            submits the checkbox value, so the payload always holds the
            required checkOnSubmit field. */}
        <form.Field
          name="checkOnSubmit"
          validators={{ onBlur: assignmentFormSchema.shape.checkOnSubmit }}
        >
          {(field) => (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">
                Check answers on submit
              </legend>
              <input
                type="checkbox"
                className="checkbox"
                name={field.name}
                checked={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
            </fieldset>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SubmitButton
              label="Save Assignment"
              submittingLabel="Saving"
              isSubmitting={isSubmitting}
            />
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
