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

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async () => {
    const invitations = await getInvitations();
    return { invitations };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const { invitations } = Route.useLoaderData();
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
          <Link to="/lessons/new" className="link">
            New lesson
          </Link>
          <Link to="/assignments/new" className="link">
            New assignment
          </Link>
        </li>
      </ul>
    </div>
  );
}
