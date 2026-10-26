import { TextField } from "@/components/text-field";
import { defaultValuesLesson, lessonFormSchema } from "@/schemas/course-schema";
import { getCoursesByUser } from "@/server/courses/get-course";
import { createLesson } from "@/server/lessons/create-lesson";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/lessons/new")({
  loader: async () => {
    const courses = await getCoursesByUser();
    return { courses };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { courses } = Route.useLoaderData();
  const navigate = useNavigate();
  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof lessonFormSchema>;
  }) => {
    await createLesson({ data: value });
    navigate({
      to: "/courses",
    });
  };
  const form = useForm({
    defaultValues: defaultValuesLesson,
    validators: {
      onSubmit: lessonFormSchema,
      onBlur: lessonFormSchema,
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
          {(field) => <TextField field={field} label="Title" />}
        </form.Field>
        <form.Field name="content">
          {(field) => <TextField field={field} label="Content" multiline />}
        </form.Field>
        <form.Field
          name="courseId"
          validators={{
            onChange: lessonFormSchema.shape.courseId,
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
        <button type="submit" className="btn btn-primary">
          Save Lesson
        </button>
      </form>
    );
  }
}
