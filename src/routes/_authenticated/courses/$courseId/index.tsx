import FormErrorAlert from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";
import CourseDetailTabsPending, {
  courseDetailTabValues,
  type CourseDetailTab,
} from "@/components/course-detail-tabs-pending";
import TabPanelSkeleton from "@/components/tab-panel-skeleton";
import SubmissionCard from "@/components/submissions/submission-card";
import { enrollmentFormSchema } from "@/schemas/course-schema";
import { getAssignmentsByCourse } from "@/server/assignments/get-assignment";
import { getSubmissionsByCourse } from "@/server/assignments/submissions/get-submission";
import { createEnrollment } from "@/server/enrollments/create-enrollment";
import { getEnrolleesByCourse } from "@/server/enrollments/get-enrollment";
import { getLessonsByCourse } from "@/server/lessons/get-lesson";
import { getUnenrolledUsers } from "@/server/users/get-user";
import { useForm } from "@tanstack/react-form";
import { getCourseByIdAndAuthor } from "@/server/courses/get-course";
import {
  createFileRoute,
  getRouteApi,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import z from "zod";

// Tab values come from courseDetailTabValues (single source of truth in
// src/components/course-detail-tabs-pending.tsx) so the two lists cannot drift.
const tabSchema = z.enum(courseDetailTabValues);
const courseDetailSearchSchema = z.object({ tab: tabSchema.optional() });

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  validateSearch: (search: Record<string, unknown>) =>
    courseDetailSearchSchema.catch({}).parse(search),
  loaderDeps: ({ search: { tab } }) => ({ tab }),
  loader: {
    // 'blocking' so revisiting an already-cached tab waits for the loader
    // (and shows the pending skeleton) instead of revalidating in background
    staleReloadMode: "blocking",
    handler: async ({ deps, params }) => {
      // Duplicated author guard: only the course author may load any tab of
      // the course detail page. A non-author is thrown to the router's
      // defaultNotFoundComponent.
      const courseId = Number(params.courseId);
      if (!Number.isInteger(courseId) || courseId <= 0) throw notFound();
      const course = await getCourseByIdAndAuthor({ data: { courseId } });
      if (!course) throw notFound();
      switch (deps.tab ?? "details") {
        case "enrollments":
          return {
            course,
            unenrolledUsers: await getUnenrolledUsers({
              data: { courseId },
            }),
            enrollees: await getEnrolleesByCourse({
              data: { courseId },
            }),
          };
        case "assignments":
          return {
            course,
            assignments: await getAssignmentsByCourse({
              data: { courseId },
            }),
          };
        case "lessons":
          return {
            course,
            lessons: await getLessonsByCourse({
              data: { courseId },
            }),
          };
        case "submissions":
          return {
            course,
            submissions: await getSubmissionsByCourse({
              data: { courseId },
            }),
          };
        default:
          // Course details
          return { course };
      }
    },
  },
  component: CourseDetailComponent,
  // Wrapped so the pending view can read the tab search param (it lives in a
  // separate component file, decoupled from this route)
  pendingComponent: () => {
    const { tab } = Route.useSearch();
    return <CourseDetailTabsPending activeTab={tab ?? "details"} />;
  },
  pendingMs: 0,
  // Generate a flash-free feel: fast loads (<300ms) swap straight to content,
  // slower loads show the skeleton held for at least 300ms
  pendingMinMs: 300,
});

const courseRouteApi = getRouteApi("/_authenticated/courses/$courseId");

/** daisyUI color class for an enrollment status badge. */
function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "badge-success";
    case "dropped":
    case "declined":
      return "badge-error";
    case "invited":
    case "completed":
      return "badge-info";
    default:
      return "";
  }
}

function CourseDetailComponent() {
  const loaderData = Route.useLoaderData();
  const { course } = loaderData;
  const unenrolledUsers =
    "unenrolledUsers" in loaderData ? loaderData.unenrolledUsers : undefined;
  const enrollees =
    "enrollees" in loaderData ? loaderData.enrollees : undefined;
  const assignments =
    "assignments" in loaderData ? loaderData.assignments : undefined;
  const lessons = "lessons" in loaderData ? loaderData.lessons : undefined;
  const submissions =
    "submissions" in loaderData ? loaderData.submissions : undefined;
  const { courseId } = Route.useParams();
  const { tab } = Route.useSearch();
  const router = useRouter();
  const navigate = courseRouteApi.useNavigate();

  const activeTab = tab ?? "details";

  const handleTabChange = (newTab: CourseDetailTab) => {
    void navigate({
      search: newTab === "details" ? {} : { tab: newTab },
    });
  };

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
        checked={activeTab === "details"}
        onChange={() => handleTabChange("details")}
      />
      <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
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
        checked={activeTab === "enrollments"}
        onChange={() => handleTabChange("enrollments")}
      />
      <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
        {!unenrolledUsers || !enrollees ? (
          <TabPanelSkeleton />
        ) : (
          <>
            <h3>Enrolled students</h3>
            {enrollees.length > 0 ? (
              <ul className="flex flex-col space-y-2">
                {enrollees.map((enrollee) => (
                  <li key={enrollee.id} className="flex items-center gap-2">
                    <span>
                      {enrollee.user.name} - {enrollee.user.email}
                    </span>
                    <span
                      className={`badge badge-outline ${statusBadgeClass(enrollee.status)}`}
                    >
                      {enrollee.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No students enrolled yet</p>
            )}

            <h3 className="mt-8">Invite a student</h3>
            {unenrolledUsers.length > 0 ? (
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
                          {unenrolledUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} - {user.email}
                            </option>
                          ))}
                        </select>

                        {errors.length > 0 && isTouched && (
                          <p className="label text-error">
                            {errors[0]?.message}
                          </p>
                        )}
                      </fieldset>
                    );
                  }}
                </form.Field>
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <SubmitButton
                      label="Send invite"
                      submittingLabel="Sending"
                      isSubmitting={isSubmitting}
                    />
                  )}
                </form.Subscribe>
              </form>
            ) : (
              <p>No students to enroll</p>
            )}
          </>
        )}
      </div>

      <input
        type="radio"
        name="course_tabs"
        className="tab"
        aria-label="Assignments"
        checked={activeTab === "assignments"}
        onChange={() => handleTabChange("assignments")}
      />
      <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
        {!assignments ? (
          <TabPanelSkeleton />
        ) : assignments.length > 0 ? (
          <ul className="flex flex-col space-y-2">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center gap-3">
                <Link
                  className="link"
                  to="/assignments/$assignmentId"
                  params={{ assignmentId: String(assignment.id) }}
                >
                  {assignment.title}
                </Link>
                <Link
                  className="btn btn-link btn-sm"
                  to="/assignments/$assignmentId/edit"
                  params={{ assignmentId: String(assignment.id) }}
                >
                  Edit assignment
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <h3>No assignments yet</h3>
        )}
      </div>

      <input
        type="radio"
        name="course_tabs"
        className="tab"
        aria-label="Lessons"
        checked={activeTab === "lessons"}
        onChange={() => handleTabChange("lessons")}
      />
      <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
        {!lessons ? (
          <TabPanelSkeleton />
        ) : lessons.length > 0 ? (
          <ul className="flex flex-col space-y-2">
            {lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center gap-3">
                <span>{lesson.title}</span>
                <Link
                  className="btn btn-link btn-sm"
                  to="/lessons/$lessonId/edit"
                  params={{ lessonId: String(lesson.id) }}
                >
                  Edit lesson
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <h3>No lessons yet</h3>
        )}
        <Link
          className="btn btn-link btn-sm mt-4 px-0"
          to="/courses/$courseId/lessons/new"
          params={{ courseId }}
        >
          Add lesson
        </Link>
      </div>

      <input
        type="radio"
        name="course_tabs"
        className="tab"
        aria-label="Submissions"
        checked={activeTab === "submissions"}
        onChange={() => handleTabChange("submissions")}
      />
      <div className="tab-content border-0 bg-base-100 p-10 min-h-96">
        {!submissions ? (
          <TabPanelSkeleton />
        ) : submissions.length > 0 ? (
          <div className="flex flex-col gap-4">
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                cardTitle={submission.assignmentTitle}
                // The card title links to this submission's review page.
                cardTitleParams={{
                  courseId,
                  assignmentId: String(submission.assignmentId),
                  submissionId: String(submission.id),
                }}
                cardDescription={
                  <>
                    {submission.assigneeName} {submission.assigneeEmail}
                    <span
                      className={`badge ml-2 ${
                        submission.submittedAt
                          ? "badge-success"
                          : "badge-neutral"
                      }`}
                    >
                      {submission.submittedAt ? "Submitted" : "In progress"}
                    </span>
                  </>
                }
                // NOTE: the card's dropdown actions are not wired to the
                // server yet. The menu is disabled until the author-side
                // mutations exist, so users cannot click no-op actions.
                handleCompleted={() => {}}
                handleReset={submission.submittedAt ? () => {} : undefined}
                actionsDisabled
              />
            ))}
          </div>
        ) : (
          <h3>No submissions yet</h3>
        )}
      </div>
    </div>
  );
}
