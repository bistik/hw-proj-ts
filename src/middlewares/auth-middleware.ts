import { getCurrentUser } from "@/lib/auth";
import { createMiddleware } from "@tanstack/react-start";

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await getCurrentUser();
    return next({ context: { user } });
  },
);
