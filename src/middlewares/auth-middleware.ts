import { getCurrentUser } from "@/lib/auth";
import { EMAIL_UNVERIFIED_MESSAGE, UnauthorizedError } from "@/lib/errors";
import { createMiddleware } from "@tanstack/react-start";

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await getCurrentUser();
    return next({ context: { user } });
  },
);

export const verifiedMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await getCurrentUser();
    if (!user.emailVerified) {
      throw new UnauthorizedError(EMAIL_UNVERIFIED_MESSAGE);
    }
    return next({ context: { user } });
  },
);
