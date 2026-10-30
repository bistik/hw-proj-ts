import { enrollmentFormSchema } from "@/schemas/course-schema";
import { createEnrollment } from "@/server/enrollments/create-enrollment";
import { getUsers } from "@/server/users/get-user";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  loader: async () => {
    const users = await getUsers();
    return { users };
  },
  component: RouteComponent,
});

const courseRouteApi = getRouteApi("/_authenticated/courses/$courseId");

function RouteComponent() {
  const { course } = courseRouteApi.useLoaderData();
  const { users } = Route.useLoaderData();
  const router = useRouter();

  const handleSubmit = async ({
    value,
  }: {
    value: z.infer<typeof enrollmentFormSchema>;
  }) => {
    let result: Awaited<ReturnType<typeof createEnrollment>>;
    const failMessage = "Could not enroll user. Please try again.";
    try {
      result = await createEnrollment({ data: value });
    } catch (err) {
      console.error("Failed to create enrollment", err);
      form.setErrorMap({
        onSubmit: {
          form: failMessage,
          fields: {},
        },
      });
      return;
    }
    if (!result.created) {
      form.setErrorMap({
        onSubmit: {
          form: "This student is already enrolled in this course.",
          fields: {},
        },
      });
      return;
    }
    form.reset();
    await router.invalidate();
  };

  const form = useForm({
    defaultValues: {
      courseId: course.id,
      userId: "",
    },
    validators: {
      onSubmit: enrollmentFormSchema,
    },
    onSubmit: handleSubmit,
  });
  return (
    <div className="tabs tabs-border" role="tablist">
      <input
        type="radio"
        name="course_tabs"
        className="tab"
        aria-label="Course Details"
        defaultChecked
      />
      <div className="tab-content border-base-300 bg-base-100 p-10">
        <h2>{course.title}</h2>
        <p>{course.description}</p>
        <Link
          className="btn btn-link btn-sm my-2 px-0"
          to="/courses/$courseId/edit"
          params={{ courseId: String(course.id) }}
        >
          Edit course
        </Link>
      </div>

      <input
        type="radio"
        name="course_tabs"
        className="tab"
        aria-label="Enrollment"
      />
      <div className="tab-content border-base-300 bg-base-100 p-10">
        {users && users.length > 0 ? (
          <>
            <h3>Enroll a student</h3>
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
              <form.Field name="userId">
                {(field) => {
                  const { errors, isTouched } = field.state.meta;
                  return (
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">Student</legend>
                      <select
                        // If state is 0, this evaluates to '' which selects the placeholder option
                        value={field.state.value || ""}
                        onBlur={() => field.handleBlur()}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="select"
                      >
                        <option value="" disabled>
                          -- Select a User --
                        </option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} - {user.email}
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
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <button
                    type="submit"
                    className="btn btn-primary my-4"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Enrolling
                      </>
                    ) : (
                      "Enroll user"
                    )}
                  </button>
                )}
              </form.Subscribe>
            </form>
          </>
        ) : (
          <h3>No students to enroll</h3>
        )}
      </div>
    </div>
  );
}
