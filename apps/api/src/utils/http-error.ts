/**
 * An error that maps directly onto an HTTP response: `statusCode` becomes
 * the response status and `code` the machine-readable `error` field, so
 * every error body has the same `{ error, message }` shape.
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}
