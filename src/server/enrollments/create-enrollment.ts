import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateInvite } from "@/db/invites/create-invite";
import { dbCreateEnrollment } from "@/db/enrollments/create-enrollment";
import { dbGetInviteContext } from "@/db/enrollments/get-enrollment";
import { dbGetCourseByIdAndAuthor } from "@/db/courses/get-course";
import { dbGetUserByEmail } from "@/db/users/get-user";
import { sendInviteEmail } from "@/lib/email/invite";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { enrollmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createEnrollment = createServerFn({ method: "POST" })
  .validator(enrollmentFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);
    try {
      // An invite addressed only by an email address (issue #31) is stored
      // by address, not by user: the schema guarantees exactly one of
      // userId/inviteEmail is filled.
      if (!data.userId) {
        const email = data.inviteEmail.trim().toLowerCase();
        const course = await dbGetCourseByIdAndAuthor(
          data.courseId,
          context.user.id,
        );
        if (course) {
          // A registered owner of the address gets a real enrollment row,
          // so the dashboard invitation flow works right away. An
          // unregistered invitee cannot be enrolled yet: the pending
          // invite row persists by email and the sign-up hook
          // (src/lib/auth.ts) converts it into an enrollment once the
          // invitee signs up with this address.
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
                courseTitle: course.title,
              });
            }
            return result;
          }
          await dbCreateInvite({ courseId: data.courseId, email });
          await sendInviteEmail({
            to: email,
            courseTitle: course.title,
            unregistered: true,
          });
        }
        return { created: true, id: null };
      }
      const result = await dbCreateEnrollment({
        courseId: data.courseId,
        userId: data.userId,
      });
      // A fresh enrollment (not an ignored re-invite of an already enrolled
      // student) triggers the invitation email. The send is awaited on
      // purpose: sendInviteEmail never throws (it catches and logs), so a
      // Mailpit or transport failure cannot fail the invite itself, and a
      // fire-and-forget send could be cancelled by the runtime once this
      // handler returns its response.
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
    } catch (err) {
      console.error("Error in enrolling a user", err);
      throw new Error("Could not enroll a user", { cause: err });
    }
  });
