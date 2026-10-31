import {
  isEmailUnverified,
  isUnauthorized,
} from "@/lib/errors";

export function ErrorBoundaryCard({ error }: { error: unknown }) {
  if (isUnauthorized(error)) {
    return (
      <div className="p-4 alert alert-warning">
        <h3>Please login</h3>
        <a href="/login" className="btn">
          Sign in again
        </a>
      </div>
    );
  }
  if (isEmailUnverified(error)) {
    return (
      <div className="p-4 alert alert-info">
        <h3>Verify your email</h3>
        <p>
          Your account email hasn&apos;t been verified yet. Please check your
          inbox for the verification link.
        </p>
      </div>
    );
  }
  const errorMessage =
    error instanceof Error ? error.message : "An unknown error occurred.";
  return (
    <div className="p-4 alert alert-danger">
      <h3>Oops! Something went wrong</h3>
      <p>{errorMessage}</p>
      <button onClick={() => window.location.reload()} className="btn">
        Try Again
      </button>
    </div>
  );
}
