export const UNAUTHORIZED_MESSAGE = "Unauthorized";

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = UNAUTHORIZED_MESSAGE) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message === UNAUTHORIZED_MESSAGE;
}
