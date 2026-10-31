import { getSessionUser } from "@/lib/auth-functions";
import { EMAIL_UNVERIFIED_MESSAGE, UnauthorizedError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/courses")({
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user.emailVerified) {
      throw new UnauthorizedError(EMAIL_UNVERIFIED_MESSAGE);
    }
  },
});
