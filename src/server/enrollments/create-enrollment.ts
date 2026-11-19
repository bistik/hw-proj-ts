import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateInvite } from "@/db/invites/mutate-invite";
import { dbCreateEnrollment } from "@/db/enrollments/create-enrollment";
import { dbGetInviteContext } from "@/db/enrollments/get-enrollment";
import { dbGetUserByEmail } from "@/db/users/get-user";
import { sendInviteEmail } from "@/lib/email/invite";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { enrollmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * Invites a registered student: the enrollment row is created and, when it
 * is fresh (not an ignored re-invite of an already invited student), the
 * invitation email is sent. The send is awaited on purpose:
 * sendInviteEmail never throws (it catches and logs), so a Mailpit or
 * transport failure cannot fail the invite itself, and a fire-and-forget
 * send could be cancelled by the runtime once this handler returns its
 * response.
 */
async function createEnrollmentForRegistered(data: {
  courseId: number;
  userId: string;
}) {
  const result = await dbCreateEnrollment({
    courseId: data.courseId,
    userId: data.userId,
  });
  if (result.created) {
    const invite = await dbGetInviteContext({
      courseId: data.courseId,
      userId: data.userId,
    });
    if (invite) {
      await sendInviteEmail({
        to: invite.studentEmail,
        name: invite.studentName,
        courseTitle: invite.courseTitle,
      });
    }
  }
  return result;
}

/**
 * Invites a person addressed only by an email address (issue #31). A
 * registered owner of the address gets a real enrollment row, so the
 * dashboard invitation flow works right away. An unregistered invitee
 * cannot be enrolled yet: the pending invite row persists by email and
 * the sign-up hook (src/lib/auth.ts) converts it into an enrollment once
 * the invitee signs up with this address.
 *
 * A repeated invite is a no-op: the (course, email) unique index ignores
 * the duplicate row and the invite email is not sent again, the same
 * behavior a repeated invite of a registered student gets.
 *
 * Accepted race: between the user lookup and the insert below, the
 * invitee can sign up and the hook can run before the invite row lands,
 * in which case the invite never converts. The window is small; a
 * re-invite by the author fixes it.
 */
async function createEnrollmentForGuest(data: {
  courseId: number;
  email: string;
  courseTitle: string;
}) {
  const email = data.email.trim().toLowerCase();
  const existingUser = await dbGetUserByEmail(email);
  if (existingUser) {
    const result = await dbCreateEnrollment({
      courseId: data.courseId,
      userId: existingUser.id,
    });
    if (result.created) {
      await sendInviteEmail({
        to: email,
        name: existingUser.name,
        courseTitle: data.courseTitle,
      });
    }
    return result;
  }
  const result = await dbCreateInvite({ courseId: data.courseId, email });
  if (!result.created) {
    // A pending invite for this address already exists, so the email
    // went out when it was created.
    return result;
  }
  await sendInviteEmail({
    to: email,
    courseTitle: data.courseTitle,
    unregistered: true,
  });
  return result;
}

export const createEnrollment = createServerFn({ method: "POST" })
  .validator(enrollmentFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    // The ownership check throws when the course does not belong to the
    // caller, and its result carries the course row both invite paths
    // need for the email title — no second course query.
    const course = await requireUserOwnsCourse(data.courseId, context.user.id);
    try {
      // The schema guarantees exactly one of userId/inviteEmail is filled.
      if (data.userId) {
        return await createEnrollmentForRegistered({
          courseId: data.courseId,
          userId: data.userId,
        });
      }
      return await createEnrollmentForGuest({
        courseId: data.courseId,
        email: data.inviteEmail,
        courseTitle: course.title,
      });
    } catch (err) {
      console.error("Error in enrolling a user", err);
      throw new Error("Could not enroll a user", { cause: err });
    }
  });
