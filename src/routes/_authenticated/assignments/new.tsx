import { TextField } from "@/components/text-field";
import {
  assignmentFormSchema,
  defaultValuesAssignment,
} from "@/schemas/course-schema";
import { createAssignment } from "@/server/assignments/mutate-assignment";
import { getCoursesByUser } from "@/server/courses/get-course";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/assignments/new")({
  loader: async () => {
    const courses = await getCoursesByUser();
    return { courses };
  },
  component: RouteComponent,
});

// Issue #84: the points dropdown offers exactly 1 to 10, same as the
// /courses/<id>/assignments/new form.
const pointsOptions = Array.from({ length: 10 }, (_, i) => i + 1);

function RouteComponent() {
  const { courses } = Route.useLoaderData();
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof assignmentFormSchema>;
  }) => {
    const result = await createAssignment({ data: value });
    if (result) {
      console.log("successfully created assignment");
    }
  };
  const form = useForm({
    defaultValues: defaultValuesAssignment,
    validators: {
      onSubmit: assignmentFormSchema,
      onBlur: assignmentFormSchema,
    },
    onSubmit: handleSubmit,
  });
  if (!courses || courses.length === 0) {
    return (
      <div>
        Please create a course first{" "}
        <Link to="/courses/new">Create course</Link>
      </div>
    );
  } else {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="title">
          {(field) => <TextField label="Title" field={field} />}
        </form.Field>
        <form.Field name="example">
          {(field) => (
            <TextField label="Example" field={field} multiline rows={8} />
          )}
        </form.Field>
        <form.Field name="points">
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
        {/* Issue #86: the same "Check answers on submit" checkbox as
            the /courses/<id>/assignments/new form. */}
        <form.Field name="checkOnSubmit">
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
        <form.Field
          name="courseId"
          validators={{
            onChange: assignmentFormSchema.shape.courseId,
          }}
        >
          {(field) => {
            const { errors, isTouched } = field.state.meta;
            return (
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Course</legend>
                <select
                  // If state is 0, this evaluates to '' which selects the placeholder option
                  value={field.state.value || ""}
                  onBlur={() => field.handleBlur()}
                  onChange={(e) =>
                    field.handleChange(Number(e.target.value) || 0)
                  }
                  className="select"
                >
                  <option value="" disabled>
                    -- Select a Course --
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>

                {errors.length > 0 && isTouched && (
                  <p className="label text-error">{errors[0]?.message}</p>
                )}
              </fieldset>
            );
          }}
        </form.Field>
        <button type="submit" className="btn">
          Save Assignment
        </button>
      </form>
    );
  }
}
