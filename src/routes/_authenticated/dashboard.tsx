import FormErrorAlert from "@/components/form-error-alert";
import {
  acceptInvitation,
  declineInvitation,
} from "@/server/enrollments/update-enrollment";
import { getInvitations } from "@/server/enrollments/get-enrollment";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

// The sign-up form navigates here with ?signUp=true (issue #60): the
// dashboard then confirms the registration and asks the user to verify
// the email address. TanStack Router serializes the boolean as the plain
// "true" string, and the default parser reads it back as a boolean.
const dashboardSearchSchema = z.object({
  signUp: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>) =>
    dashboardSearchSchema.catch({}).parse(search),
  loader: async () => {
    const invitations = await getInvitations();
    return { invitations };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const { invitations } = Route.useLoaderData();
  const { signUp } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (courseId: number) => {
    setError(null);
    try {
      await acceptInvitation({ data: { courseId } });
    } catch (err) {
      console.error(`Failed to accept invitation for course ${courseId}`, err);
      setError("Could not accept invitation. Please try again.");
      return;
    }
    // Only redirect after the accept succeeded.
    await navigate({
      to: "/student/courses/$courseId",
      params: { courseId: String(courseId) },
    });
  };

  const handleDecline = async (courseId: number) => {
    setError(null);
    try {
      await declineInvitation({ data: { courseId } });
    } catch (err) {
      console.error(`Failed to decline invitation for course ${courseId}`, err);
      setError("Could not decline invitation. Please try again.");
      return;
    }
    await router.invalidate();
  };

  return (
    <div>
      <h2>Welcome back! {user.name}</h2>
      <p>dashboard"!</p>

      {/* Issue #60: shown only on the visit right after the sign-up
          form redirects here. States both facts: the registration
          succeeded, and the email address still needs verification. */}
      {signUp && (
        <div role="status" className="alert alert-success my-4">
          You registered successfully. Check your inbox and verify your email
          address.
        </div>
      )}

      {error && <FormErrorAlert errorMsg={error} />}

      {invitations.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 text-lg font-semibold">Pending invitations</h3>
          <ul className="flex flex-col space-y-2">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3">
                <span>You are invited to enroll in {invitation.course.title}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={() => void handleAccept(invitation.courseId)}
                >
                  accept
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-error"
                  onClick={() => void handleDecline(invitation.courseId)}
                >
                  decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul>
        <li className="space-x-2">
          <Link to="/student/courses" className="link">
            Enrolled courses
          </Link>
          <Link to="/courses" className="link">
            Courses
          </Link>
          <Link to="/courses/new" className="link">
            New course
          </Link>
          {/* No "New lesson" link: the global /lessons/new route is removed
              (issue #22). Lesson creation is course-scoped, so its entry
              point is the "Add lesson" link on the course detail Lessons
              tab. */}
          <Link to="/assignments/new" className="link">
            New assignment
          </Link>
        </li>
      </ul>
    </div>
  );
}
