// Unit tests run against an in-memory libSQL database, so no Turso
// instance or .env file is needed. Vitest loads .env into process.env
// before this file runs, so the values must be overwritten, not just
// defaulted. The guard below stops a test run from touching a remote
// database if the override ever stops working.
process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "test-token";

if (
  !process.env.TURSO_DATABASE_URL.startsWith(":memory:") &&
  !process.env.TURSO_DATABASE_URL.startsWith("file:")
) {
  throw new Error(
    "Unit tests must not connect to a remote database. " +
      `TURSO_DATABASE_URL was: ${process.env.TURSO_DATABASE_URL}`,
  );
}
