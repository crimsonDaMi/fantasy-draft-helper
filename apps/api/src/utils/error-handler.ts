import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { HttpError } from "./http-error.js";

/**
 * The app-wide Fastify error handler. Exported on its own so route tests
 * can register the exact same mapping instead of a hand-rolled copy.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Invalid request parameters",
      details: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  return reply.status(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
}
