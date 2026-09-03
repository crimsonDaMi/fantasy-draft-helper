import Fastify from "fastify";
import cors from "@fastify/cors";

import { draftsRoutes } from "./routes/drafts.routes.js";

import { ZodError } from "zod";

import { HttpError } from "./utils/http-error.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  await app.register(
    draftsRoutes,
  );

  app.setErrorHandler(
    (error, request, reply) => {
      request.log.error(error);

      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",

          message:
            "Invalid request parameters",

          details: error.issues,
        });
      }

      if (error instanceof HttpError) {
        return reply
          .status(error.statusCode)
          .send({
            error: "SLEEPER_API_ERROR",

            message: error.message,
          });
      }

      return reply.status(500).send({
        error: "INTERNAL_SERVER_ERROR",

        message:
          "An unexpected error occurred",
      });
    },
  );

  return app;
}