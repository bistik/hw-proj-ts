// Fixed credentials for the E2E environment. The user is seeded in
// global-setup.ts via the better-auth sign-up API, which handles password
// hashing; no SQL-side seeding is needed.
export const TEST_USER = {
  name: "E2E User",
  email: "e2e-test-user@example.test",
  password: "e2e-password-1234",
} as const;

// A second seeded user who owns nothing. Used to prove that resources are
// author-scoped: anything TEST_USER created must be invisible to this user.
export const OTHER_USER = {
  name: "E2E Other User",
  email: "e2e-other-user@example.test",
  password: "e2e-other-password-1234",
} as const;
