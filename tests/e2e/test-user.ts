// Fixed credentials for the E2E environment. The user is seeded in
// global-setup.ts via the better-auth sign-up API, which handles password
// hashing; no SQL-side seeding is needed.
export const TEST_USER = {
  name: "E2E User",
  email: "e2e-test-user@example.test",
  password: "e2e-password-1234",
} as const;
