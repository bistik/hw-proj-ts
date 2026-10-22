import { createAuthClient } from "better-auth/react";

// drop the baseURL, better-auth is on the same domain as the app
export const authClient = createAuthClient();
