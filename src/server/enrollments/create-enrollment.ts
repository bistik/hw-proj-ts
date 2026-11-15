import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateEnrollment } from "@/db/enrollments/create-enrollment";
import { dbGetInviteContext } from "@/db/enrollments/get-enrollment";
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
