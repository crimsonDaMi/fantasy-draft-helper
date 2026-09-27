/**
 * Errors thrown by services and repositories for expected failures, kept
 * free of HTTP details. `utils/error-handler.ts` maps each onto its status
 * code; `code` becomes the response's machine-readable `error` field.
 */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";

  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export class ConflictError extends Error {
  override readonly name = "ConflictError";

  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}
