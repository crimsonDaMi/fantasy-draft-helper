/**
 * Errors thrown by services and repositories for expected failures, kept
 * free of HTTP details. `utils/error-handler.ts` maps each onto its status
 * code; `code` becomes the response's machine-readable `error` field.
 */
abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  override readonly name = "NotFoundError";
}

export class ConflictError extends DomainError {
  override readonly name = "ConflictError";
}

/** Missing or wrong credentials. */
export class UnauthorizedError extends DomainError {
  override readonly name = "UnauthorizedError";
}

/** Authenticated or not, the action isn't allowed. */
export class ForbiddenError extends DomainError {
  override readonly name = "ForbiddenError";
}

export class TooManyRequestsError extends DomainError {
  override readonly name = "TooManyRequestsError";
}
