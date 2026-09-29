import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "./domain-errors.js";
import { HttpError } from "./http-error.js";

const DOMAIN_ERROR_STATUS = [
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [TooManyRequestsError, 429],
] as const;

interface ErrorResponse {
  status: number;
  body: { error: string; message: string; details?: unknown };
}

function toErrorResponse(error: FastifyError | Error): ErrorResponse {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: error.issues,
      },
    };
  }

  if (error instanceof HttpError) {
    return {
      status: error.statusCode,
      body: {
        error: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }

  for (const [errorClass, status] of DOMAIN_ERROR_STATUS) {
    if (error instanceof errorClass) {
      return { status, body: { error: error.code, message: error.message } };
    }
  }

  return {
    status: 500,
    body: {
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  };
}

/**
 * The app-wide Fastify error handler. Exported on its own so route tests
 * can register the exact same mapping instead of a hand-rolled copy.
 * Expected failures (4xx) are logged at info, so the error log only holds
 * server-side and upstream failures.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { status, body } = toErrorResponse(error);

  if (status >= 500) {
    request.log.error(error);
  } else {
    request.log.info({ err: error }, body.message);
  }

  return reply.status(status).send(body);
}
