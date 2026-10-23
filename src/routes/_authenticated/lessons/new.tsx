import { defaultValuesLesson, lessonFormSchema } from "@/schemas/course-schema";
import { getCoursesByUser } from "@/server/courses/get-course";
import { createLesson } from "@/server/lessons/create-lesson";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/lessons/new")({
  loader: async ({ context }) => {
    const courses = await getCoursesByUser({ data: context.user.id });
    return { courses };
  },
  component: RouteComponent,
});

type LessonInput = z.infer<typeof lessonFormSchema>;

function RouteComponent() {
  const { courses } = Route.useLoaderData();
  const handleSubmit = async ({ value }: { value: LessonInput }) => {
    const result = await createLesson({ data: value });
    if (result) {
      console.log("Successful create lesson");
    }
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
        <form.Field name="content">
          {(field) => {
            const { errors, isTouched } = field.state.meta;
            return (
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Content</legend>
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
        <button type="submit" className="btn">
          Save Lesson
        </button>
      </form>
    );
  }
}
